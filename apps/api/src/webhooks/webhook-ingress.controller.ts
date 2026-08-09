import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { WebhookIngressService } from './webhook-ingress.service';
import { WebhookRateLimitService } from './webhook-rate-limit.service';

@Controller('hooks')
export class WebhookIngressController {
  constructor(
    private readonly webhookIngressService: WebhookIngressService,
    private readonly webhookRateLimit: WebhookRateLimitService,
  ) {}

  @Post(':publicId')
  @HttpCode(HttpStatus.ACCEPTED)
  async acceptWebhook(
    @Param('publicId') publicId: string,
    @Headers('content-type') contentType: string | undefined,
    @Headers('x-hooklane-event-id') sourceEventId: string | undefined,
    @Headers('x-hooklane-timestamp') timestampHeader: string | undefined,
    @Headers('x-hooklane-signature') signatureHeader: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ) {
    if (!contentType || !this.isJsonContentType(contentType)) {
      throw new UnsupportedMediaTypeException(
        'Webhook content type must be application/json',
      );
    }

    if (!request.rawBody) {
      throw new BadRequestException('Missing raw request body');
    }

    await this.webhookRateLimit.assertAllowed(
      publicId,
      request.ip || 'unknown',
    );

    return this.webhookIngressService.acceptWebhook({
      publicId,
      rawBody: request.rawBody,
      payload: request.body,
      contentType,
      sourceEventId,
      timestampHeader,
      signatureHeader,
    });
  }

  private isJsonContentType(contentType: string): boolean {
    const mediaType = contentType.split(';')[0]?.trim().toLowerCase();

    return mediaType === 'application/json' || mediaType.endsWith('+json');
  }
}
