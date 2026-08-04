import type { CreateCreditsCheckoutRequest } from '@hooklane/contracts';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCreditsCheckoutDto implements CreateCreditsCheckoutRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/)
  productCode!: string;
}
