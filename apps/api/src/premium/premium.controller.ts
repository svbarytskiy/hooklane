import { Controller, Get, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { PremiumAccessGuard } from './guards/premium-access.guard';

@Controller('premium')
export class PremiumController {
  @UseGuards(SupabaseAuthGuard, PremiumAccessGuard)
  @Get('content')
  getPremiumContent() {
    return {
      content: 'Premium billing lab content',
    };
  }
}
