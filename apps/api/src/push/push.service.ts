import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PUSH_PROVIDER,
  type PushPayload,
  type PushProvider,
} from './push-provider.interface';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';

@Injectable()
export class PushService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_PROVIDER) private readonly provider: PushProvider,
  ) {}

  /** Save/refresh a shop owner's device subscription (AUC-21). */
  async subscribe(shopId: string, dto: CreatePushSubscriptionDto) {
    await this.prisma.db.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: { shopId, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
      create: {
        shopId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
    });
  }

  async unsubscribe(endpoint: string) {
    await this.prisma.db.pushSubscription.deleteMany({ where: { endpoint } });
  }

  /** Web Push every device a shop has subscribed, pruning subscriptions the push service reports gone. */
  async notifyShop(shopId: string, payload: PushPayload) {
    const subscriptions = await this.prisma.db.pushSubscription.findMany({
      where: { shopId },
    });
    if (subscriptions.length === 0) return;

    const expiredEndpoints: string[] = [];
    await Promise.all(
      subscriptions.map(async (sub) => {
        const result = await this.provider.send(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        if (result.expired) expiredEndpoints.push(sub.endpoint);
      }),
    );

    if (expiredEndpoints.length > 0) {
      await this.prisma.db.pushSubscription.deleteMany({
        where: { endpoint: { in: expiredEndpoints } },
      });
    }
  }
}
