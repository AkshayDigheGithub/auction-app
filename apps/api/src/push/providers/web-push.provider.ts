import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import type {
  PushPayload,
  PushProvider,
  PushSendResult,
  PushSubscriptionData,
} from '../push-provider.interface';

/** Real Web Push delivery via VAPID (AUC-21). Active once VAPID_PRIVATE_KEY is set. */
@Injectable()
export class WebPushProvider implements PushProvider {
  private readonly logger = new Logger('Push');
  private vapidConfigured = false;

  async send(
    subscription: PushSubscriptionData,
    payload: PushPayload,
  ): Promise<PushSendResult> {
    // Deferred to first use — this provider is always instantiated by Nest
    // (see push.module.ts), even when the noop provider is the one selected,
    // so reading/validating the keys can't happen eagerly in the constructor.
    if (!this.vapidConfigured) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT ?? 'mailto:support@example.com',
        process.env.VAPID_PUBLIC_KEY as string,
        process.env.VAPID_PRIVATE_KEY as string,
      );
      this.vapidConfigured = true;
    }

    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      return { expired: false };
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) return { expired: true };
      this.logger.error(`Push send failed: ${(err as Error).message}`);
      return { expired: false };
    }
  }
}
