import { Injectable, Logger } from '@nestjs/common';
import type {
  PushPayload,
  PushProvider,
  PushSendResult,
  PushSubscriptionData,
} from '../push-provider.interface';

/** Dev-mode fallback when VAPID keys aren't set — logs instead of sending (AUC-21). */
@Injectable()
export class NoopPushProvider implements PushProvider {
  private readonly logger = new Logger('Push');
  private warned = false;

  send(
    _subscription: PushSubscriptionData,
    payload: PushPayload,
  ): Promise<PushSendResult> {
    if (!this.warned) {
      this.logger.warn(
        'VAPID_PRIVATE_KEY not set — Web Push notifications are logged, not sent.',
      );
      this.warned = true;
    }
    this.logger.debug(`[DEV] Would push: "${payload.title}" — ${payload.body}`);
    return Promise.resolve({ expired: false });
  }
}
