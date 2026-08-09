import type { UpdateWorkflowDraftRequest } from '@hooklane/contracts';
import { IsObject } from 'class-validator';

export class UpdateWorkflowDraftDto implements UpdateWorkflowDraftRequest {
  @IsObject()
  definition!: UpdateWorkflowDraftRequest['definition'];
}
