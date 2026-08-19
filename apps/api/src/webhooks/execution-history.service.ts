import type {
  CancelExecutionResponse,
  ExecutionAttempt,
  ExecutionDetail,
  ExecutionStatus,
  ExecutionStep,
  ExecutionSummary,
} from '@hooklane/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import {
  executionAttempts,
  executionSteps,
  executions,
  workflows,
} from 'src/database/schema';

@Injectable()
export class ExecutionHistoryService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listExecutions(
    workspaceId: string,
    workflowId: string,
  ): Promise<ExecutionSummary[]> {
    const rows = await this.db
      .select({
        id: executions.id,
        workflowId: executions.workflowId,
        workflowName: workflows.name,
        workflowVersionId: executions.workflowVersionId,
        incomingEventId: executions.incomingEventId,
        status: executions.status,
        queuedAt: executions.queuedAt,
        startedAt: executions.startedAt,
        completedAt: executions.completedAt,
        failure: executions.failure,
        createdAt: executions.createdAt,
      })
      .from(executions)
      .innerJoin(workflows, eq(workflows.id, executions.workflowId))
      .where(
        and(
          eq(executions.workspaceId, workspaceId),
          eq(executions.workflowId, workflowId),
        ),
      )
      .orderBy(desc(executions.createdAt))
      .limit(50);

    return rows.map((row) => this.toSummary(row));
  }

  async getExecution(
    workspaceId: string,
    workflowId: string,
    executionId: string,
  ): Promise<ExecutionDetail> {
    const [execution] = await this.db
      .select({
        id: executions.id,
        workflowId: executions.workflowId,
        workflowName: workflows.name,
        workflowVersionId: executions.workflowVersionId,
        incomingEventId: executions.incomingEventId,
        status: executions.status,
        queuedAt: executions.queuedAt,
        startedAt: executions.startedAt,
        completedAt: executions.completedAt,
        failure: executions.failure,
        createdAt: executions.createdAt,
      })
      .from(executions)
      .innerJoin(workflows, eq(workflows.id, executions.workflowId))
      .where(
        and(
          eq(executions.id, executionId),
          eq(executions.workspaceId, workspaceId),
          eq(executions.workflowId, workflowId),
        ),
      )
      .limit(1);

    if (!execution) throw new NotFoundException('Execution not found');

    const [attemptRows, stepRows] = await Promise.all([
      this.db
        .select()
        .from(executionAttempts)
        .where(eq(executionAttempts.executionId, executionId))
        .orderBy(desc(executionAttempts.attemptNumber)),
      this.db
        .select({
          id: executionSteps.id,
          attemptId: executionSteps.attemptId,
          stepId: executionSteps.stepId,
          stepIndex: executionSteps.stepIndex,
          status: executionSteps.status,
          input: executionSteps.input,
          output: executionSteps.output,
          error: executionSteps.error,
          startedAt: executionSteps.startedAt,
          completedAt: executionSteps.completedAt,
          attemptNumber: executionAttempts.attemptNumber,
        })
        .from(executionSteps)
        .innerJoin(
          executionAttempts,
          eq(executionAttempts.id, executionSteps.attemptId),
        )
        .where(eq(executionSteps.executionId, executionId))
        .orderBy(
          desc(executionAttempts.attemptNumber),
          executionSteps.stepIndex,
        ),
    ]);

    return {
      ...this.toSummary(execution),
      attempts: attemptRows.map((attempt) => ({
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status as ExecutionAttempt['status'],
        startedAt: attempt.startedAt?.toISOString() ?? null,
        completedAt: attempt.completedAt?.toISOString() ?? null,
        error: attempt.error,
      })),
      steps: stepRows.map((step) => ({
        id: step.id,
        attemptId: step.attemptId,
        stepId: step.stepId,
        stepIndex: step.stepIndex,
        status: step.status as ExecutionStep['status'],
        input: step.input,
        output: step.output,
        error: step.error,
        startedAt: step.startedAt?.toISOString() ?? null,
        completedAt: step.completedAt?.toISOString() ?? null,
      })),
    };
  }

  async cancelExecution(
    workspaceId: string,
    workflowId: string,
    executionId: string,
  ): Promise<CancelExecutionResponse> {
    const [cancelled] = await this.db
      .update(executions)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(executions.id, executionId),
          eq(executions.workspaceId, workspaceId),
          eq(executions.workflowId, workflowId),
          inArray(executions.status, ['pending', 'queued', 'running']),
        ),
      )
      .returning({ id: executions.id });

    if (cancelled) return { id: cancelled.id, status: 'cancelled' };

    const [execution] = await this.db
      .select({ id: executions.id })
      .from(executions)
      .where(
        and(
          eq(executions.id, executionId),
          eq(executions.workspaceId, workspaceId),
          eq(executions.workflowId, workflowId),
        ),
      )
      .limit(1);

    if (!execution) throw new NotFoundException('Execution not found');
    throw new ConflictException(
      'Only pending, queued, or running executions can be cancelled',
    );
  }

  private toSummary(row: {
    id: string;
    workflowId: string;
    workflowName: string;
    workflowVersionId: string;
    incomingEventId: string;
    status: string;
    queuedAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    failure: unknown;
    createdAt: Date;
  }): ExecutionSummary {
    return {
      ...row,
      status: row.status as ExecutionStatus,
      queuedAt: row.queuedAt?.toISOString() ?? null,
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
