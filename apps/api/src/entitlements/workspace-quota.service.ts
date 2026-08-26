import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Database } from 'src/database/database.types';

type QuotaResult =
  | 'allowed'
  | 'reserved'
  | 'entitlement_missing'
  | 'entitlement_inactive'
  | 'execution_limit_exceeded'
  | 'published_workflow_limit_exceeded'
  | 'integration_limit_exceeded';

type QueryExecutor = Pick<Database, 'execute'>;

@Injectable()
export class WorkspaceQuotaService {
  async reserveExecution(
    executor: QueryExecutor,
    workspaceId: string,
    executionId: string,
  ): Promise<void> {
    const result = await this.readResult(
      executor,
      sql`select public.reserve_workspace_execution_quota(${workspaceId}, ${executionId}) as result`,
    );
    this.assertResult(result, 'execution');
  }

  async assertCanPublishWorkflow(
    executor: QueryExecutor,
    workspaceId: string,
    workflowId: string,
  ): Promise<void> {
    const result = await this.readResult(
      executor,
      sql`select public.workspace_can_publish_workflow(${workspaceId}, ${workflowId}) as result`,
    );
    this.assertResult(result, 'published workflow');
  }

  async assertCanActivateIntegration(
    executor: QueryExecutor,
    workspaceId: string,
    provider: string,
    providerAccountId: string,
  ): Promise<void> {
    const result = await this.readResult(
      executor,
      sql`select public.workspace_can_activate_integration(${workspaceId}, ${provider}, ${providerAccountId}) as result`,
    );
    this.assertResult(result, 'integration');
  }

  private async readResult(
    executor: QueryExecutor,
    query: ReturnType<typeof sql>,
  ): Promise<QuotaResult> {
    const rows = (await executor.execute(query)) as Array<{ result?: unknown }>;
    const result = rows[0]?.result;

    if (typeof result !== 'string') {
      throw new ServiceUnavailableException(
        'Workspace entitlement usage could not be evaluated',
      );
    }

    return result as QuotaResult;
  }

  private assertResult(result: QuotaResult, resource: string): void {
    if (result === 'allowed' || result === 'reserved') {
      return;
    }

    if (result === 'entitlement_inactive') {
      throw new ForbiddenException(
        'This workspace billing entitlement is inactive',
      );
    }

    if (result === 'entitlement_missing') {
      throw new ServiceUnavailableException(
        'This workspace has no billing entitlement',
      );
    }

    throw new HttpException(
      `This workspace has reached its ${resource} plan limit`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
