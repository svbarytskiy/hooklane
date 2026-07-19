import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { AuthController } from './auth.controller';
import { AdminGuard } from './admin/admin.guard';
import { SupabaseAuthGuard } from './supabase-auth/supabase-auth.guard';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [SupabaseModule, DatabaseModule],
  providers: [AuthService, SupabaseAuthGuard, AdminGuard],
  exports: [AuthService, SupabaseAuthGuard, AdminGuard],
  controllers: [AuthController],
})
export class AuthModule {}
