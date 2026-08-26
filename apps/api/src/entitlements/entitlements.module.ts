import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { WorkspacesModule } from 'src/workspaces/workspaces.module';
import { WorkspaceEntitlementsController } from './workspace-entitlements.controller';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import { WorkspaceEntitlementSyncService } from './workspace-entitlement-sync.service';
import { WorkspaceQuotaService } from './workspace-quota.service';
import { ExecutionRetentionService } from './execution-retention.service';
import { ScheduledTaskLockService } from './scheduled-task-lock.service';

@Module({
  imports: [DatabaseModule, WorkspacesModule],
  controllers: [WorkspaceEntitlementsController],
  providers: [
    WorkspaceEntitlementsService,
    WorkspaceEntitlementSyncService,
    WorkspaceQuotaService,
    ExecutionRetentionService,
    ScheduledTaskLockService,
  ],
  exports: [
    WorkspaceEntitlementsService,
    WorkspaceEntitlementSyncService,
    WorkspaceQuotaService,
    ScheduledTaskLockService,
  ],
})
export class EntitlementsModule {}
