import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { DatabaseModule } from 'src/database/database.module';
import { WorkspacesModule } from 'src/workspaces/workspaces.module';
import { WebhookEndpointsController } from './webhook-endpoints.controller';
import { WebhookEndpointsService } from './webhook-endpoints.service';
import { WebhookSecretCryptoService } from './webhook-secret-crypto.service';

@Module({
  imports: [AuthModule, DatabaseModule, WorkspacesModule],
  providers: [WebhookSecretCryptoService, WebhookEndpointsService],
  exports: [WebhookSecretCryptoService, WebhookEndpointsService],
  controllers: [WebhookEndpointsController],
})
export class WebhooksModule {}
