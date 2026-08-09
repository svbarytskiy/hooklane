import type { CreateWebhookEndpointRequest } from '@hooklane/contracts';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateWebhookEndpointDto implements CreateWebhookEndpointRequest {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : null))
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsIn(['hmac_sha256', 'none'])
  signatureMode?: 'hmac_sha256' | 'none';
}
