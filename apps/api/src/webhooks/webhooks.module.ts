import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { DatabaseModule } from 'src/database/database.module';
import { WorkspacesModule } from 'src/workspaces/workspaces.module';
import { WebhookEndpointsController } from './webhook-endpoints.controller';
import { WebhookEndpointsService } from './webhook-endpoints.service';
import { WebhookIngressController } from './webhook-ingress.controller';
import { WebhookIngressService } from './webhook-ingress.service';
import { WebhookDeliveryController } from './webhook-delivery.controller';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookRateLimitService } from './webhook-rate-limit.service';
import { WebhookSecretCryptoService } from './webhook-secret-crypto.service';
import { WebhookSignatureService } from './webhook-signature.service';
import { ExecutionHistoryController } from './execution-history.controller';
import { ExecutionHistoryService } from './execution-history.service';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';

@Module({
  imports: [AuthModule, DatabaseModule, WorkspacesModule, EntitlementsModule],
  providers: [
    WebhookSecretCryptoService,
    WebhookSignatureService,
    WebhookEndpointsService,
    WebhookIngressService,
    WebhookDeliveryService,
    WebhookRateLimitService,
    ExecutionHistoryService,
  ],
  exports: [WebhookSecretCryptoService, WebhookEndpointsService],
  controllers: [
    WebhookEndpointsController,
    WebhookIngressController,
    WebhookDeliveryController,
    ExecutionHistoryController,
  ],
})
export class WebhooksModule {}
