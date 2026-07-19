import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { profiles } from 'src/database/schema';
import { AuthenticatedRequest } from '../supabase-auth/supabase-auth.guard';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('User is not authenticated');
    }

    const [profile] = await this.db
      .select({
        role: profiles.role,
      })
      .from(profiles)
      .where(eq(profiles.id, request.user.id))
      .limit(1);

    if (!profile || profile.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
