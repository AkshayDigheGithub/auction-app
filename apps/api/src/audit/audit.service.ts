import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Every privileged action an admin can take. Kept as a closed union so a new
 * admin capability has to consciously declare itself here rather than logging
 * an untracked free-text string.
 */
export type AuditAction =
  | 'wallet.adjust'
  | 'rate.update'
  | 'shop.verify'
  | 'shop.unverify'
  | 'shop.suspend'
  | 'shop.unsuspend'
  | 'shop.categories.update'
  | 'reversal.approve'
  | 'reversal.reject'
  | 'dispute.uphold'
  | 'dispute.dismiss'
  | 'product_category.create'
  | 'product_category.update'
  | 'product_category.deactivate';

export interface AuditRecordInput {
  actorUserId: string;
  action: AuditAction;
  targetType:
    | 'shop'
    | 'commission_rate'
    | 'deal'
    | 'reversal'
    | 'dispute'
    | 'product_category';
  targetId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

/**
 * Append-only audit trail (AUC-65).
 *
 * Admins can move money, so every privileged action must be attributable —
 * "who credited this shop ₹2,000 and why" needs an answer that doesn't depend
 * on someone remembering. There is deliberately no update or delete method:
 * the only writes this service performs are inserts.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput) {
    try {
      return await this.prisma.db.adminAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          before: (input.before ?? null) as never,
          after: (input.after ?? null) as never,
          ip: input.ip,
        },
      });
    } catch (err) {
      // An audit write must never take down the action it is recording, but a
      // silent failure would be worse — log loudly so it surfaces in monitoring.
      this.logger.error(
        `FAILED to write audit log for ${input.action} on ${input.targetType}:${input.targetId} by ${input.actorUserId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async list(
    opts: {
      actorUserId?: string;
      action?: AuditAction;
      targetType?: string;
      targetId?: string;
      from?: Date;
      to?: Date;
      skip?: number;
      take?: number;
    } = {},
  ) {
    const where = {
      ...(opts.actorUserId ? { actorUserId: opts.actorUserId } : {}),
      ...(opts.action ? { action: opts.action } : {}),
      ...(opts.targetType ? { targetType: opts.targetType } : {}),
      ...(opts.targetId ? { targetId: opts.targetId } : {}),
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
      this.prisma.db.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip ?? 0,
        take: Math.min(opts.take ?? 50, 200),
      }),
      this.prisma.db.adminAuditLog.count({ where }),
    ]);
    return { rows, total };
  }
}
