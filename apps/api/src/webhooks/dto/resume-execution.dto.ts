import type { ResumeExecutionRequest } from '@hooklane/contracts';
import {
  Allow,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class ResumeExecutionDto implements ResumeExecutionRequest {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(200)
  stepId!: string;

  @Allow()
  output!: unknown;
}
