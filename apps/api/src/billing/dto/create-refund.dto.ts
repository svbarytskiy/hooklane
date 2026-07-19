import type { CreateRefundRequest } from '@billing-lab/contracts';
import { IsInt, IsOptional, Min } from 'class-validator';

export class CreateRefundDto implements CreateRefundRequest {
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;
}
