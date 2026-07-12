import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth.types';
import { AuthService } from '../auth.service';
import type { Request } from 'express';

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const authHeader = request.header('authorization');
    const accessToken = this.extractBearerToken(authHeader);

    const user = await this.authService.verifyAccessToken(accessToken);

    (request as AuthenticatedRequest).user = user;

    return true;
  }

  private extractBearerToken(authHeader: string | undefined): string {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization header');
    }

    return token;
  }
}
