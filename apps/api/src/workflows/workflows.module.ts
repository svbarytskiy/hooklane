import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { DatabaseModule } from 'src/database/database.module';
import { WorkspacesModule } from 'src/workspaces/workspaces.module';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';

@Module({
  imports: [AuthModule, DatabaseModule, WorkspacesModule, EntitlementsModule],
  providers: [WorkflowsService],
  controllers: [WorkflowsController],
})
export class WorkflowsModule {}
