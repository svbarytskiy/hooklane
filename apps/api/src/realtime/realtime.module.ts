import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { DatabaseModule } from 'src/database/database.module';
import { WorkspacesModule } from 'src/workspaces/workspaces.module';
import { ExecutionNotificationBus } from './execution-notification.bus';
import { ExecutionNotificationPublisher } from './execution-notification.publisher';
import { ExecutionNotificationSubscriber } from './execution-notification.subscriber';
import { ExecutionRealtimeGateway } from './execution-realtime.gateway';

@Module({
  imports: [AuthModule, DatabaseModule, WorkspacesModule],
  providers: [
    ExecutionNotificationBus,
    ExecutionNotificationPublisher,
    ExecutionNotificationSubscriber,
    ExecutionRealtimeGateway,
  ],
  exports: [ExecutionNotificationBus],
})
export class RealtimeModule {}
