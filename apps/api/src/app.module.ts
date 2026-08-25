import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { ProfilesModule } from './profiles/profiles.module';
import { StripeModule } from './stripe/stripe.module';
import { BillingModule } from './billing/billing.module';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { PremiumModule } from './premium/premium.module';
import { RedisModule } from './redis/redis.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { QueuesModule } from './queues/queues.module';
import { RealtimeModule } from './realtime/realtime.module';
import { IntegrationsModule } from './integrations/integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api/.env.local', '.env.local', '.env'],
      validate: validateEnv,
    }),
    SupabaseModule,
    AuthModule,
    DatabaseModule,
    ProfilesModule,
    StripeModule,
    BillingModule,
    PremiumModule,
    RedisModule,
    WorkspacesModule,
    WorkflowsModule,
    WebhooksModule,
    QueuesModule,
    RealtimeModule,
    IntegrationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
