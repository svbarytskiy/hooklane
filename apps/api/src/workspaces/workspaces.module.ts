import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { AuthModule } from 'src/auth/auth.module';
import { DatabaseModule } from 'src/database/database.module';
import { WorkspaceMemberGuard } from './guards/workspace-member.guard';

@Module({
  providers: [WorkspacesService, WorkspaceMemberGuard],
  exports: [WorkspacesService, WorkspaceMemberGuard],
  controllers: [WorkspacesController],
  imports: [AuthModule, DatabaseModule],
})
export class WorkspacesModule {}
