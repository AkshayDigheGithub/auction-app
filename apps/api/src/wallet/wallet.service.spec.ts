import { InsufficientBalanceError, WalletService } from './wallet.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * A minimal in-memory stand-in for the bits of Prisma the wallet touches.
 * Enough to exercise the invariants without a database — and specifically to
 * prove that a balance never moves without a ledger row.
 */
function makeFakePrisma(initialBalancePaise: number) {
  const state = {
    balance: initialBalancePaise,
    ledger: [] as Array<Record<string, unknown>>,
    updateCalls: 0,
  };

  const client = {
    shop: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'shop_1' ? { id: 'shop_1', walletBalancePaise: state.balance } : null,
      ),
      update: jest.fn(async ({ data }: { data: { walletBalancePaise: number } }) => {
        state.updateCalls += 1;
        state.balance = data.walletBalancePaise;
        return { id: 'shop_1', walletBalancePaise: state.balance };
      }),
    },
    walletTransaction: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.ledger.push(data);
        return { id: `txn_${state.ledger.length}`, ...data };
      }),
    },
    // Runs the callback immediately; if it throws, roll the fake state back so
    // the test sees the same all-or-nothing behaviour the database gives.
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const snapshot = { balance: state.balance, ledgerLength: state.ledger.length };
      try {
        return await fn(client);
      } catch (err) {
        state.balance = snapshot.balance;
        state.ledger.length = snapshot.ledgerLength;
        throw err;
      }
    }),
  };

  return { state, prisma: { db: client } as unknown as PrismaService };
}

describe('WalletService', () => {
  it('credits and records the resulting balance on the ledger row', async () => {
    const { state, prisma } = makeFakePrisma(0);
    const wallet = new WalletService(prisma);

    await wallet.credit({ shopId: 'shop_1', type: 'recharge', amountPaise: 100_000, reason: 'Top-up' });

    expect(state.balance).toBe(100_000);
    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0]).toMatchObject({
      type: 'recharge',
      amountPaise: 100_000,
      balanceAfterPaise: 100_000,
    });
  });

  it('debits as a negative ledger entry', async () => {
    const { state, prisma } = makeFakePrisma(100_000);
    const wallet = new WalletService(prisma);

    await wallet.debit({ shopId: 'shop_1', type: 'deal_fee', amountPaise: 30_000, reason: 'Deal fee' });

    expect(state.balance).toBe(70_000);
    expect(state.ledger[0]).toMatchObject({ amountPaise: -30_000, balanceAfterPaise: 70_000 });
  });

  it('refuses a debit that would go negative, and leaves nothing behind', async () => {
    const { state, prisma } = makeFakePrisma(10_000);
    const wallet = new WalletService(prisma);

    await expect(
      wallet.debit({ shopId: 'shop_1', type: 'deal_fee', amountPaise: 30_000, reason: 'Deal fee' }),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);

    // The invariant that matters: no balance change AND no ledger row.
    expect(state.balance).toBe(10_000);
    expect(state.ledger).toHaveLength(0);
  });

  it('allows a debit that lands exactly on zero', async () => {
    const { state, prisma } = makeFakePrisma(30_000);
    const wallet = new WalletService(prisma);

    await wallet.debit({ shopId: 'shop_1', type: 'deal_fee', amountPaise: 30_000, reason: 'Deal fee' });

    expect(state.balance).toBe(0);
    expect(state.ledger[0]).toMatchObject({ balanceAfterPaise: 0 });
  });

  it('writes a ledger row for every balance change, without exception', async () => {
    const { state, prisma } = makeFakePrisma(0);
    const wallet = new WalletService(prisma);

    await wallet.credit({ shopId: 'shop_1', type: 'recharge', amountPaise: 100_000, reason: 'Top-up' });
    await wallet.credit({ shopId: 'shop_1', type: 'bonus', amountPaise: 10_000, reason: 'Slab bonus' });
    await wallet.debit({ shopId: 'shop_1', type: 'deal_fee', amountPaise: 18_000, reason: 'Fee' });
    await wallet.credit({ shopId: 'shop_1', type: 'reversal', amountPaise: 18_000, reason: 'Reversed' });

    expect(state.updateCalls).toBe(state.ledger.length);
    expect(state.balance).toBe(110_000);
    // balanceAfter on each row should reconstruct the running balance.
    expect(state.ledger.map((r) => r.balanceAfterPaise)).toEqual([100_000, 110_000, 92_000, 110_000]);
  });

  it('records a zero-value trial waiver without moving the balance', async () => {
    const { state, prisma } = makeFakePrisma(0);
    const wallet = new WalletService(prisma);

    await wallet.post({
      shopId: 'shop_1',
      type: 'trial_waiver',
      amountPaise: 0,
      reason: 'Free trial deal 1 of 3',
    });

    expect(state.balance).toBe(0);
    // Still a ledger row: "why was this deal free?" needs an answer.
    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0]).toMatchObject({ type: 'trial_waiver', amountPaise: 0 });
  });

  it('rejects a zero or negative credit', async () => {
    const { prisma } = makeFakePrisma(0);
    const wallet = new WalletService(prisma);

    await expect(
      wallet.credit({ shopId: 'shop_1', type: 'recharge', amountPaise: 0, reason: 'x' }),
    ).rejects.toThrow();
    await expect(
      wallet.credit({ shopId: 'shop_1', type: 'recharge', amountPaise: -5, reason: 'x' }),
    ).rejects.toThrow();
  });

  describe('adjust', () => {
    it('requires a meaningful reason', async () => {
      const { prisma } = makeFakePrisma(0);
      const wallet = new WalletService(prisma);

      await expect(
        wallet.adjust({ shopId: 'shop_1', amountPaise: 10_000, reason: 'x', actorUserId: 'admin_1' }),
      ).rejects.toThrow(/reason/i);
    });

    it('records the acting admin on the ledger row', async () => {
      const { state, prisma } = makeFakePrisma(0);
      const wallet = new WalletService(prisma);

      await wallet.adjust({
        shopId: 'shop_1',
        amountPaise: 50_000,
        reason: 'Goodwill credit after failed recharge',
        actorUserId: 'admin_1',
      });

      expect(state.ledger[0]).toMatchObject({
        type: 'admin_credit',
        createdByUserId: 'admin_1',
        reason: 'Goodwill credit after failed recharge',
      });
    });

    it('uses admin_debit for a negative adjustment', async () => {
      const { state, prisma } = makeFakePrisma(50_000);
      const wallet = new WalletService(prisma);

      await wallet.adjust({
        shopId: 'shop_1',
        amountPaise: -20_000,
        reason: 'Reversing a duplicate credit',
        actorUserId: 'admin_1',
      });

      expect(state.ledger[0]).toMatchObject({ type: 'admin_debit', amountPaise: -20_000 });
    });
  });
});
