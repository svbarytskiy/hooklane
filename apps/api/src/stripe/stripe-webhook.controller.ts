import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { StripeWebhookService } from './stripe-webhook.service';

@Controller('stripe')
export class StripeWebhookController {
  constructor(private readonly stripeWebhookService: StripeWebhookService) {}

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

    const isNewEvent = await this.stripeWebhookService.storeEvent(event);

    return {
      received: true,
      duplicate: !isNewEvent,
      eventId: event.id,
      eventType: event.type,
    };
  }
}
