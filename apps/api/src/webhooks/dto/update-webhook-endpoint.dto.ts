import type { UpdateWebhookEndpointRequest } from '@hooklane/contracts';
import { IsIn } from 'class-validator';

export class UpdateWebhookEndpointDto implements UpdateWebhookEndpointRequest {
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}
