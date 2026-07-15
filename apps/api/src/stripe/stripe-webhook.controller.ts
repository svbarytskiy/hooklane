import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { StripeWebhookProcessor } from './stripe-webhook-processor.service';
import { StripeWebhookService } from './stripe-webhook.service';

@Controller('stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripeWebhookService: StripeWebhookService,
    private readonly stripeWebhookProcessor: StripeWebhookProcessor,
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    if (!request.rawBody) {
      throw new BadRequestException('Missing raw request body');
    }

    const event = this.stripeWebhookService.constructEvent(
      request.rawBody,
      signature,
    );

    const storedEvent = await this.stripeWebhookService.storeEvent(event);

    if (
      storedEvent.status === 'processed' ||
      storedEvent.status === 'ignored'
    ) {
      return {
        received: true,
        duplicate: !storedEvent.isNew,
        eventId: event.id,
        eventType: event.type,
        status: storedEvent.status,
      };
    }

    try {
      const status = await this.stripeWebhookProcessor.process(event);

      await this.stripeWebhookService.markEventStatus(event.id, status);

      return {
        received: true,
        duplicate: !storedEvent.isNew,
        eventId: event.id,
        eventType: event.type,
        status,
      };
    } catch (error) {
      await this.stripeWebhookService.markEventFailed(event.id, error);

      throw error;
    }
  }
}
