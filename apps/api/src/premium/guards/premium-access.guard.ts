import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from 'src/auth/supabase-auth/supabase-auth.guard';
import { SubscriptionService } from 'src/billing/subscription.service';

@Injectable()
export class PremiumAccessGuard implements CanActivate {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Authenticated user is missing');
    }

    const hasAccess = await this.subscriptionService.hasPremiumAccess(
      request.user.id,
    );

    if (!hasAccess) {
      throw new ForbiddenException('An active subscription is required');
    }

    return true;
  }
}
