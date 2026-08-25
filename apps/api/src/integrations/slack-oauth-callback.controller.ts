import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OAuthConnectionsService } from './oauth-connections.service';

@Controller('oauth/slack')
export class SlackOAuthCallbackController {
  constructor(private readonly oauthConnections: OAuthConnectionsService) {}

  @Get('callback')
  async completeSlackAuthorization(
    @Query('code') code: string | string[] | undefined,
    @Query('state') state: string | string[] | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (typeof code !== 'string' || typeof state !== 'string') {
      response.redirect(
        302,
        this.oauthConnections.getFrontendOAuthResultUrl(null, 'failed'),
      );
      return;
    }

    try {
      const { workspaceId } = await this.oauthConnections.completeAuthorization(
        'slack',
        code,
        state,
      );
      response.redirect(
        302,
        this.oauthConnections.getFrontendOAuthResultUrl(
          workspaceId,
          'connected',
        ),
      );
    } catch {
      response.redirect(
        302,
        this.oauthConnections.getFrontendOAuthResultUrl(null, 'failed'),
      );
    }
  }
}
