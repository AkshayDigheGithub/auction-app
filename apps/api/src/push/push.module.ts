import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { PUSH_PROVIDER } from './push-provider.interface';
import { WebPushProvider } from './providers/web-push.provider';
import { NoopPushProvider } from './providers/noop-push.provider';

@Module({
  providers: [
    PushService,
    WebPushProvider,
    NoopPushProvider,
    {
      provide: PUSH_PROVIDER,
      useFactory: (real: WebPushProvider, noop: NoopPushProvider) =>
        process.env.VAPID_PRIVATE_KEY ? real : noop,
      inject: [WebPushProvider, NoopPushProvider],
    },
  ],
  exports: [PushService],
})
export class PushModule {}
