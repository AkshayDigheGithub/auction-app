import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * Realtime layer for bidding (AUC-4). Rooms:
 *  - `request:{requestId}` — customers watching one request's live bid list.
 *  - `shop:{shopId}` — a shop owner's session, used to push "new request
 *    nearby" notifications. This substitutes for real Web Push/VAPID at MVP
 *    scaffold stage — swap in a proper Web Push subscription flow later
 *    without changing the call sites (requestsService calls notifyShopsNearby()).
 */
/*
 * CORS is deliberately NOT set here. Decorator arguments are evaluated at
 * class-definition time — before ConfigModule has loaded `.env` — so reading
 * the allowlist at this point silently fell back to localhost and killed the
 * live bid feed. It is applied at bootstrap instead: see CorsIoAdapter in
 * main.ts.
 */
@WebSocketGateway()
export class RealtimeGateway {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  @SubscribeMessage('join-request')
  joinRequest(@ConnectedSocket() client: Socket, @MessageBody() requestId: string) {
    client.join(`request:${requestId}`);
  }

  @SubscribeMessage('leave-request')
  leaveRequest(@ConnectedSocket() client: Socket, @MessageBody() requestId: string) {
    client.leave(`request:${requestId}`);
  }

  @SubscribeMessage('join-shop')
  joinShop(@ConnectedSocket() client: Socket, @MessageBody() shopId: string) {
    client.join(`shop:${shopId}`);
  }

  broadcastNewBid(requestId: string, bid: unknown) {
    this.server.to(`request:${requestId}`).emit('bid:new', bid);
  }

  broadcastDealLocked(requestId: string, deal: unknown) {
    this.server.to(`request:${requestId}`).emit('deal:locked', deal);
  }

  broadcastDealCompleted(requestId: string, deal: unknown) {
    this.server.to(`request:${requestId}`).emit('deal:completed', deal);
  }

  notifyShopNewRequest(shopId: string, request: unknown) {
    this.server.to(`shop:${shopId}`).emit('request:nearby', request);
  }
}
