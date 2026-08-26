import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

/**
 * Wraps PrismaClient instead of extending it: the generated client throws
 * synchronously in its constructor when no driver adapter is passed, which
 * would crash the whole Nest app at boot if DATABASE_URL is unset. Composing
 * it lets the app start with DB-backed routes failing individually (503)
 * instead of the process never coming up.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private client: PrismaClient | null = null;
  readonly isConfigured: boolean;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    this.isConfigured = Boolean(databaseUrl);
    if (this.isConfigured) {
      const adapter = new PrismaPg({ connectionString: databaseUrl });
      this.client = new PrismaClient({ adapter });
    }
  }

  /** The live Prisma client. Throws a 503 if DATABASE_URL was never set. */
  get db(): PrismaClient {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Database is not configured. Set DATABASE_URL in apps/api/.env (see .env.example).',
      );
    }
    return this.client;
  }

  async onModuleInit() {
    if (!this.client) {
      this.logger.warn(
        'DATABASE_URL not set — database-backed routes will return 503 until it is configured.',
      );
      return;
    }
    await this.client.$connect();
    this.logger.log('Connected to database.');
  }

  async onModuleDestroy() {
    if (this.client) await this.client.$disconnect();
  }
}
