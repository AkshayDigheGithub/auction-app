import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatPaise } from '../pricing/fee.util';
import type { Prisma } from '../../generated/prisma/client.js';

export type WalletTxnTypeName =
  | 'recharge'
  | 'deal_fee'
  | 'reversal'
  | 'bonus'
  | 'admin_credit'
  | 'admin_debit'
  | 'trial_waiver';

export interface LedgerEntryInput {
  shopId: string;
  type: WalletTxnTypeName;
  /** Positive to credit, negative to debit. */
  amountPaise: number;
  reason: string;
  dealId?: string;
  createdByUserId?: string;
}

/** Thrown when a debit would take a wallet below zero. */
export class InsufficientBalanceError extends BadRequestException {
  constructor(
    readonly shopId: string,
    readonly balancePaise: number,
    readonly requiredPaise: number,
  ) {
    super(
      `Insufficient wallet balance: ${formatPaise(balancePaise)} available, ${formatPaise(requiredPaise)} required.`,
    );
  }
}

/**
 * The prepaid wallet (AUC-48).
 *
 * The single invariant everything else depends on: **a balance never moves
 * without a ledger row, and both happen in one database transaction.** A
 * balance change with no matching ledger row is a bug, not an edge case, so the
 * only way to move money in this service is `post()`.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger('WalletService');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apply one signed movement and write its ledger row atomically.
   *
   * `tx` lets a caller enlist this in a wider transaction — the deal-locking
   * path does exactly that, so a deal and its fee are all-or-nothing.
   */
  async post(entry: LedgerEntryInput, tx?: PrismaTx) {
    const run = async (client: PrismaTx) => {
      const shop = await client.shop.findUnique({
        where: { id: entry.shopId },
        select: { id: true, walletBalancePaise: true },
      });
      if (!shop) throw new NotFoundException(`Shop ${entry.shopId} not found`);

      const balanceAfter = shop.walletBalancePaise + entry.amountPaise;
      if (balanceAfter < 0) {
        throw new InsufficientBalanceError(
          entry.shopId,
          shop.walletBalancePaise,
          Math.abs(entry.amountPaise),
        );
      }

      await client.shop.update({
        where: { id: entry.shopId },
        data: { walletBalancePaise: balanceAfter },
      });

      return client.walletTransaction.create({
        data: {
          shopId: entry.shopId,
          type: entry.type,
          amountPaise: entry.amountPaise,
          balanceAfterPaise: balanceAfter,
          dealId: entry.dealId,
          reason: entry.reason,
          createdByUserId: entry.createdByUserId,
        },
      });
    };

    return tx ? run(tx) : this.prisma.db.$transaction(run);
  }

  // `async` so validation failures reject rather than throwing synchronously.
  // A method that sometimes throws and sometimes rejects forces every caller to
  // guard both ways, and one of them will eventually be forgotten.
  async credit(
    entry: Omit<LedgerEntryInput, 'amountPaise'> & { amountPaise: number },
    tx?: PrismaTx,
  ) {
    if (entry.amountPaise <= 0)
      throw new BadRequestException('Credit amount must be positive');
    return this.post(entry, tx);
  }

  async debit(
    entry: Omit<LedgerEntryInput, 'amountPaise'> & { amountPaise: number },
    tx?: PrismaTx,
  ) {
    if (entry.amountPaise <= 0)
      throw new BadRequestException('Debit amount must be positive');
    return this.post({ ...entry, amountPaise: -entry.amountPaise }, tx);
  }

  async getBalance(shopId: string): Promise<number> {
    const shop = await this.prisma.db.shop.findUnique({
      where: { id: shopId },
      select: { walletBalancePaise: true },
    });
    if (!shop) throw new NotFoundException(`Shop ${shopId} not found`);
    return shop.walletBalancePaise;
  }

  async ledger(
    shopId: string,
    opts: {
      type?: WalletTxnTypeName;
      from?: Date;
      to?: Date;
      skip?: number;
      take?: number;
    } = {},
  ) {
    const where = {
      shopId,
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.from || opts.to
        ? {
            createdAt: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lte: opts.to } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip ?? 0,
        take: Math.min(opts.take ?? 50, 200),
      }),
      this.prisma.db.walletTransaction.count({ where }),
    ]);
    return { rows, total };
  }

  /**
   * Manual admin credit/debit (AUC-64). Support needs this on day one for
   * failed recharges and goodwill. The reason is mandatory and the acting admin
   * is recorded — see AdminAuditLog for the wider trail.
   */
  async adjust(input: {
    shopId: string;
    amountPaise: number;
    reason: string;
    actorUserId: string;
  }) {
    if (input.amountPaise === 0)
      throw new BadRequestException('Adjustment cannot be zero');
    if (!input.reason || input.reason.trim().length < 5) {
      throw new BadRequestException(
        'A reason of at least 5 characters is required for manual adjustments',
      );
    }

    const txn = await this.post({
      shopId: input.shopId,
      type: input.amountPaise > 0 ? 'admin_credit' : 'admin_debit',
      amountPaise: input.amountPaise,
      reason: input.reason.trim(),
      createdByUserId: input.actorUserId,
    });

    this.logger.warn(
      `Manual wallet adjustment by ${input.actorUserId}: shop ${input.shopId} ${
        input.amountPaise > 0 ? '+' : ''
      }${formatPaise(input.amountPaise)} — "${input.reason.trim()}"`,
    );
    return txn;
  }

  /** Platform-wide wallet totals for the admin dashboard (AUC-63). */
  async platformTotals() {
    const [floatAgg, byType] = await Promise.all([
      this.prisma.db.shop.aggregate({ _sum: { walletBalancePaise: true } }),
      this.prisma.db.walletTransaction.groupBy({
        by: ['type'],
        _sum: { amountPaise: true },
        _count: { _all: true },
      }),
    ]);

    const sumFor = (t: WalletTxnTypeName) =>
      byType.find((r) => r.type === t)?._sum.amountPaise ?? 0;

    return {
      // Money shops have paid in but not yet consumed. This is a LIABILITY —
      // service owed, not revenue earned. Never add it to fees earned.
      floatOutstandingPaise: floatAgg._sum.walletBalancePaise ?? 0,
      rechargedPaise: sumFor('recharge'),
      bonusGrantedPaise: sumFor('bonus'),
      // deal_fee rows are negative; flip the sign for display.
      feesConsumedPaise: Math.abs(sumFor('deal_fee')),
      reversedPaise: sumFor('reversal'),
      adminCreditPaise: sumFor('admin_credit'),
      adminDebitPaise: Math.abs(sumFor('admin_debit')),
      byType,
    };
  }
}

/**
 * The transaction-scoped Prisma client — the full client minus the methods that
 * can't be called inside a transaction ($transaction, $connect, and friends).
 *
 * Typed properly rather than `any` on purpose: this is the money path, and it
 * is exactly where a wrong column name would otherwise slip through unnoticed.
 */
export type PrismaTx = Prisma.TransactionClient;
