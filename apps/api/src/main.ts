import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import { allowedOrigins } from './common/cors-origins';

/**
 * Applies the CORS allowlist to Socket.io at bootstrap rather than at import
 * time (AUC-78).
 *
 * The obvious place for this is the `@WebSocketGateway({ cors })` decorator,
 * and that is where it used to live — but a decorator's arguments are evaluated
 * when the class is *defined*, i.e. while `app.module.ts` is still resolving its
 * own top-level imports. `ConfigModule.forRoot()` is what loads `.env` into
 * `process.env`, and it does not run until the module's `imports` array is
 * processed, which is strictly later. So the decorator called `allowedOrigins()`
 * against an unpopulated `process.env` and silently fell back to localhost,
 * while `enableCors` below — running inside async `bootstrap()` — saw the real
 * value. REST worked, the socket did not.
 *
 * That failure is invisible: no error is logged, the page loads, and only the
 * live bid feed stops updating. It only bites where `CORS_ORIGIN` comes from a
 * `.env` file (local, docker) rather than injected process env (Railway,
 * Vercel), which is exactly what makes it easy to ship unnoticed.
 *
 * Configuring the adapter here removes the ordering question altogether: this
 * runs after the module graph is built, so the value is always the loaded one.
 */
class CorsIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: allowedOrigins(), credentials: true },
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: allowedOrigins(),
    credentials: true,
  });
  app.useWebSocketAdapter(new CorsIoAdapter(app));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}/api`);
}
bootstrap();
