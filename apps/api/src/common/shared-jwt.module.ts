import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

/**
 * JwtAuthGuard (used via @UseGuards across most controllers) depends on
 * JwtService. Registering it globally means every module gets it without
 * each one importing AuthModule just for the guard's sake.
 */
@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-only-change-me',
      signOptions: { expiresIn: '30d' },
    }),
  ],
  exports: [JwtModule],
})
export class SharedJwtModule {}
