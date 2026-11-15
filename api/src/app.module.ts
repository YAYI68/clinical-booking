import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ResetController } from './admin/reset.controller';
import { BookingsController } from './bookings/bookings.controller';
import { BookingsService } from './bookings/bookings.service';
import { IdempotencyStore } from './bookings/idempotency.store';
import { RateLimiterService } from './bookings/rate-limiter.service';
import { ApiKeyGuard } from './common/api-key.guard';
import { ErrorFilter } from './common/error.filter';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';
import { APP_CONFIG, loadConfig } from './config';
import { DatabaseService } from './database/database.service';
import { DemoSeedService } from './database/demo-seed.service';
import { HealthController } from './health.controller';
import { SlotsController } from './slots/slots.controller';
import { SlotsService } from './slots/slots.service';

@Module({
  controllers: [HealthController, SlotsController, BookingsController, ResetController],
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig() },
    DatabaseService,
    DemoSeedService,
    SlotsService,
    BookingsService,
    IdempotencyStore,
    RateLimiterService,
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
