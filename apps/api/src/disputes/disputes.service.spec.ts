import { DisputesService } from './disputes.service';
import type { PrismaService } from '../prisma/prisma.service';
import { DISPUTE_WINDOW_DAYS } from './dispute.constants';

const CUSTOMER = 'user_customer';
const SHOP_OWNER = 'user_shop_owner';
const STRANGER = 'user_stranger';
const DEAL_ID = 'deal_1';
const SHOP_ID = 'shop_1';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/**
 * In-memory stand-in for the handful of Prisma calls disputes touch. Enough to
 * exercise who may say what about whom, which is where the rules live.
 */
function makeService(opts: { dealCreatedAt?: Date; existing?: unknown } = {}) {
  const created: Array<Record<string, unknown>> = [];
  const updated: Array<Record<string, unknown>> = [];

  const client = {
    deal: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === DEAL_ID
          ? {
              id: DEAL_ID,
              customerUserId: CUSTOMER,
              shopId: SHOP_ID,
              createdAt: opts.dealCreatedAt ?? new Date(),
              shop: { id: SHOP_ID, ownerUserId: SHOP_OWNER },
            }
          : null,
      ),
    },
    shop: {
      findUnique: jest.fn(
        async ({ where }: { where: { ownerUserId: string } }) =>
          where.ownerUserId === SHOP_OWNER ? { id: SHOP_ID } : null,
      ),
    },
    dispute: {
      findUnique: jest.fn(async () => opts.existing ?? null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: `dispute_${created.length}`, ...data };
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          updated.push(data);
          return { id: where.id, dealId: DEAL_ID, shopId: SHOP_ID, ...data };
        },
      ),
    },
  };

  const service = new DisputesService({ db: client } as unknown as PrismaService);
  return { service, client, created, updated };
}

describe('DisputesService.raise — who may say what (AUC-34)', () => {
  it('records a customer complaint against the shop on the deal', async () => {
    const { service, created } = makeService();

    await service.raise({
      userId: CUSTOMER,
      role: 'customer',
      dealId: DEAL_ID,
      reason: 'bid_not_honoured',
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      dealId: DEAL_ID,
      // Denormalised from the deal, not supplied by the caller.
      shopId: SHOP_ID,
      raisedByUserId: CUSTOMER,
      raisedByParty: 'customer',
      reason: 'bid_not_honoured',
    });
  });

  it('lets a shop owner report a no-show on their own deal', async () => {
    const { service, created } = makeService();

    await service.raise({
      userId: SHOP_OWNER,
      role: 'shop_owner',
      dealId: DEAL_ID,
      reason: 'customer_no_show',
    });

    expect(created[0]).toMatchObject({ raisedByParty: 'shop_owner' });
  });

  it('refuses a reason the raiser is not allowed to give', async () => {
    // The point of the split: a shop filing "the shop wouldn't honour its bid"
    // against itself would make the per-shop complaint count meaningless.
    const { service, created } = makeService();

    await expect(
      service.raise({
        userId: SHOP_OWNER,
        role: 'shop_owner',
        dealId: DEAL_ID,
        reason: 'bid_not_honoured',
      }),
    ).rejects.toThrow('cannot raise');

    await expect(
      service.raise({
        userId: CUSTOMER,
        role: 'customer',
        dealId: DEAL_ID,
        reason: 'customer_no_show',
      }),
    ).rejects.toThrow('cannot raise');

    expect(created).toHaveLength(0);
  });

  it('refuses someone who was not part of the deal', async () => {
    const { service } = makeService();

    await expect(
      service.raise({
        userId: STRANGER,
        role: 'customer',
        dealId: DEAL_ID,
        reason: 'conduct',
        details: 'they were extremely rude to me',
      }),
    ).rejects.toThrow('Not your deal');

    await expect(
      service.raise({
        userId: STRANGER,
        role: 'shop_owner',
        dealId: DEAL_ID,
        reason: 'customer_no_show',
      }),
    ).rejects.toThrow('does not belong to your shop');
  });

  it('requires details for the open-ended reasons', async () => {
    const { service } = makeService();

    await expect(
      service.raise({
        userId: CUSTOMER,
        role: 'customer',
        dealId: DEAL_ID,
        reason: 'other',
        details: 'bad',
      }),
    ).rejects.toThrow('at least 10 characters');

    await expect(
      service.raise({
        userId: CUSTOMER,
        role: 'customer',
        dealId: DEAL_ID,
        reason: 'other',
        details: 'they sold me a different model entirely',
      }),
    ).resolves.toBeDefined();
  });

  it('closes the window after the configured number of days', async () => {
    const { service } = makeService({
      dealCreatedAt: daysAgo(DISPUTE_WINDOW_DAYS + 1),
    });

    await expect(
      service.raise({
        userId: CUSTOMER,
        role: 'customer',
        dealId: DEAL_ID,
        reason: 'bid_not_honoured',
      }),
    ).rejects.toThrow(`within ${DISPUTE_WINDOW_DAYS} days`);
  });

  it('allows one complaint per person per deal', async () => {
    const { service } = makeService({
      existing: { id: 'dispute_existing', status: 'open' },
    });

    await expect(
      service.raise({
        userId: CUSTOMER,
        role: 'customer',
        dealId: DEAL_ID,
        reason: 'bid_not_honoured',
      }),
    ).rejects.toThrow('already raised');
  });
});

describe('DisputesService.resolve', () => {
  it('records the outcome, the note and who decided', async () => {
    const { service, updated } = makeService({
      existing: { id: 'dispute_1', status: 'open' },
    });

    await service.resolve({
      disputeId: 'dispute_1',
      outcome: 'upheld',
      note: 'Shop confirmed it quoted a lower price by mistake',
      resolvedByUserId: 'admin_1',
    });

    expect(updated[0]).toMatchObject({
      status: 'upheld',
      resolvedByUserId: 'admin_1',
      resolutionNote: 'Shop confirmed it quoted a lower price by mistake',
    });
    expect(updated[0].resolvedAt).toBeInstanceOf(Date);
  });

  it('insists on a reason in both directions', async () => {
    // An upheld dispute justifies a later suspension and a dismissal is what
    // the complainant is told; neither is worth anything unexplained.
    const { service, updated } = makeService({
      existing: { id: 'dispute_1', status: 'open' },
    });

    await expect(
      service.resolve({
        disputeId: 'dispute_1',
        outcome: 'dismissed',
        note: 'no',
        resolvedByUserId: 'admin_1',
      }),
    ).rejects.toThrow('at least 5 characters');
    expect(updated).toHaveLength(0);
  });

  it('will not re-decide one that is already settled', async () => {
    const { service } = makeService({
      existing: { id: 'dispute_1', status: 'dismissed' },
    });

    await expect(
      service.resolve({
        disputeId: 'dispute_1',
        outcome: 'upheld',
        note: 'changed my mind about this one',
        resolvedByUserId: 'admin_1',
      }),
    ).rejects.toThrow('already dismissed');
  });
});
