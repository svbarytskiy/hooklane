import type { CreateWorkspaceRequest } from '@hooklane/contracts';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateWorkspaceDto implements CreateWorkspaceRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}
