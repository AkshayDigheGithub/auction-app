export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushSendResult {
  /** True when the push service reports the subscription is gone (404/410) and should be dropped. */
  expired: boolean;
}

export interface PushProvider {
  send(
    subscription: PushSubscriptionData,
    payload: PushPayload,
  ): Promise<PushSendResult>;
}

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');
