import type { CreateSubscriptionCheckoutRequest } from '@billing-lab/contracts';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateSubscriptionCheckoutDto implements CreateSubscriptionCheckoutRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/)
  productCode!: string;
}
