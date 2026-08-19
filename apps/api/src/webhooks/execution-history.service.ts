import type {
  CancelExecutionResponse,
  ExecutionObservability,
  ExecutionRecoveryOperation,
  RecoverExecutionResponse,
  ReplayExecutionResponse,
  ResumeExecutionRequest,
  ExecutionAttempt,
  ExecutionDetail,
  ExecutionStatus,
  ExecutionStep,
  ExecutionSummary,
} from '@hooklane/contracts';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Queue } from 'bullmq';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import {
  executionAttempts,
  executionOutbox,
  executionRecoveries,
  executionSteps,
  executions,
  workflows,
} from 'src/database/schema';
import { WORKFLOW_EXECUTION_QUEUE_CLIENT } from 'src/queues/queue.tokens';

@Injectable()
export class ExecutionHistoryService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(WORKFLOW_EXECUTION_QUEUE_CLIENT)
    private readonly queue: Queue,
  ) {}

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
        runSequence: executions.runSequence,
        replayedFromExecutionId: executions.replayedFromExecutionId,
        deadLetteredAt: executions.deadLetteredAt,
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
        runSequence: executions.runSequence,
        replayedFromExecutionId: executions.replayedFromExecutionId,
        deadLetteredAt: executions.deadLetteredAt,
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

    const [attemptRows, stepRows, recoveryRows] = await Promise.all([
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
      this.db
        .select()
        .from(executionRecoveries)
        .where(eq(executionRecoveries.executionId, executionId))
        .orderBy(desc(executionRecoveries.createdAt)),
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
      recoveries: recoveryRows.map((recovery) => ({
        id: recovery.id,
        operation: recovery.operation as ExecutionRecoveryOperation,
        fromAttemptId: recovery.fromAttemptId,
        stepId: recovery.stepId,
        targetExecutionId: recovery.targetExecutionId,
        requestedBy: recovery.requestedBy,
        createdAt: recovery.createdAt.toISOString(),
      })),
    };
  }

  async retryFailedStep(
    workspaceId: string,
    workflowId: string,
    executionId: string,
    requestedBy: string,
  ): Promise<RecoverExecutionResponse> {
    const execution = await this.loadRecoverableExecution(
      workspaceId,
      workflowId,
      executionId,
      ['failed'],
    );
    const failedStep = await this.loadLatestFailedStep(executionId);
    if (!failedStep) {
      throw new ConflictException('Execution has no failed step to retry');
    }
    if (this.errorCode(failedStep.error) === 'http_ambiguous_result') {
      throw new ConflictException(
        'Ambiguous steps must be reconciled with resume or replayed as new',
      );
    }

    const checkpoint = await this.buildCheckpoint(
      executionId,
      failedStep.attemptId,
      failedStep.stepIndex,
    );
    return this.scheduleRecovery(execution, {
      operation: 'retry_failed_step',
      requestedBy,
      fromAttemptId: failedStep.attemptId,
      stepId: failedStep.stepId,
      startStepIndex: failedStep.stepIndex,
      checkpoint,
    });
  }

  async resumeExecution(
    workspaceId: string,
    workflowId: string,
    executionId: string,
    requestedBy: string,
    request: ResumeExecutionRequest,
  ): Promise<RecoverExecutionResponse> {
    if (!request.stepId?.trim()) {
      throw new ConflictException('Resolved step ID is required');
    }
    if (!Object.prototype.hasOwnProperty.call(request, 'output')) {
      throw new BadRequestException('Reconciled step output is required');
    }
    const execution = await this.loadRecoverableExecution(
      workspaceId,
      workflowId,
      executionId,
      ['failed'],
    );
    const failedStep = await this.loadLatestFailedStep(executionId);
    if (
      !failedStep ||
      failedStep.stepId !== request.stepId ||
      this.errorCode(failedStep.error) !== 'http_ambiguous_result'
    ) {
      throw new ConflictException(
        'Resume requires the latest ambiguous step and a reconciled output',
      );
    }

    const checkpoint = await this.buildCheckpoint(
      executionId,
      failedStep.attemptId,
      failedStep.stepIndex,
    );
    checkpoint.steps[failedStep.stepId] = { output: request.output };

    return this.scheduleRecovery(execution, {
      operation: 'resume',
      requestedBy,
      fromAttemptId: failedStep.attemptId,
      stepId: failedStep.stepId,
      startStepIndex: failedStep.stepIndex + 1,
      checkpoint,
      resolutionOutput: request.output,
    });
  }

  async replayAsNew(
    workspaceId: string,
    workflowId: string,
    executionId: string,
    requestedBy: string,
  ): Promise<ReplayExecutionResponse> {
    const source = await this.loadRecoverableExecution(
      workspaceId,
      workflowId,
      executionId,
      ['succeeded', 'failed', 'cancelled', 'dead_lettered'],
    );

    const result = await this.db.transaction(async (tx) => {
      const [target] = await tx
        .insert(executions)
        .values({
          workspaceId,
          workflowId,
          workflowVersionId: source.workflowVersionId,
          incomingEventId: source.incomingEventId,
          replayedFromExecutionId: source.id,
          status: 'pending',
        })
        .returning({ id: executions.id });
      if (!target) throw new ConflictException('Replay could not be created');

      const [recovery] = await tx
        .insert(executionRecoveries)
        .values({
          executionId: source.id,
          targetExecutionId: target.id,
          operation: 'replay_as_new',
          requestedBy,
        })
        .returning({ id: executionRecoveries.id });
      await tx.insert(executionOutbox).values({ executionId: target.id });
      return { target, recovery };
    });

    return {
      recoveryId: result.recovery.id,
      executionId: result.target.id,
      sourceExecutionId: source.id,
      status: 'pending',
    };
  }

  async deadLetterExecution(
    workspaceId: string,
    workflowId: string,
    executionId: string,
    requestedBy: string,
  ): Promise<RecoverExecutionResponse> {
    await this.loadRecoverableExecution(workspaceId, workflowId, executionId, [
      'failed',
    ]);

    const result = await this.db.transaction(async (tx) => {
      const [recovery] = await tx
        .insert(executionRecoveries)
        .values({
          executionId,
          operation: 'dead_letter',
          requestedBy,
        })
        .returning({ id: executionRecoveries.id });
      const [updated] = await tx
        .update(executions)
        .set({
          status: 'dead_lettered',
          deadLetteredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(executions.id, executionId), eq(executions.status, 'failed')),
        )
        .returning({ id: executions.id });
      if (!updated) throw new ConflictException('Execution state changed');
      return recovery;
    });

    return { recoveryId: result.id, executionId, status: 'dead_lettered' };
  }

  async getObservability(
    workspaceId: string,
    workflowId: string,
  ): Promise<ExecutionObservability> {
    const workflowFilter = and(
      eq(executions.workspaceId, workspaceId),
      eq(executions.workflowId, workflowId),
    );
    const retriedExecutions = this.db
      .select({ executionId: executionAttempts.executionId })
      .from(executionAttempts)
      .innerJoin(executions, eq(executions.id, executionAttempts.executionId))
      .where(workflowFilter)
      .groupBy(executionAttempts.executionId)
      .having(sql`count(*) > 1`)
      .as('retried_executions');
    const [statusRows, [summary], [retrySummary], counts, waitingJobs] =
      await Promise.all([
        this.db
          .select({ status: executions.status, total: count() })
          .from(executions)
          .where(workflowFilter)
          .groupBy(executions.status),
        this.db
          .select({
            total: count(),
            ambiguous: sql<number>`count(*) filter (
              where ${executions.failure} ->> 'code' = 'http_ambiguous_result'
            )::integer`,
            averageDurationMs: sql<number | null>`round(
              avg(
                extract(epoch from (${executions.completedAt} - ${executions.startedAt})) * 1000
              ) filter (
                where ${executions.startedAt} is not null
                  and ${executions.completedAt} is not null
              )
            )`,
          })
          .from(executions)
          .where(workflowFilter),
        this.db.select({ total: count() }).from(retriedExecutions),
        this.queue.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
          'completed',
        ),
        this.queue.getJobs(['waiting'], 0, 0, true),
      ]);

    const byStatus: Record<string, number> = {};
    for (const row of statusRows) {
      byStatus[row.status] = row.total;
    }
    const oldestTimestamp = waitingJobs[0]?.timestamp;

    return {
      executions: {
        byStatus,
        total: summary?.total ?? 0,
        retried: retrySummary?.total ?? 0,
        ambiguous: summary?.ambiguous ?? 0,
        averageDurationMs:
          summary?.averageDurationMs === null ||
          summary?.averageDurationMs === undefined
            ? null
            : Number(summary.averageDurationMs),
      },
      queue: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
        completed: counts.completed ?? 0,
        oldestWaitingAgeMs: oldestTimestamp
          ? Math.max(0, Date.now() - oldestTimestamp)
          : null,
      },
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

  private async loadRecoverableExecution(
    workspaceId: string,
    workflowId: string,
    executionId: string,
    statuses: string[],
  ) {
    const [execution] = await this.db
      .select({
        id: executions.id,
        workspaceId: executions.workspaceId,
        workflowId: executions.workflowId,
        workflowVersionId: executions.workflowVersionId,
        incomingEventId: executions.incomingEventId,
        status: executions.status,
        runSequence: executions.runSequence,
      })
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
    if (!statuses.includes(execution.status)) {
      throw new ConflictException(
        `Execution status ${execution.status} does not support this operation`,
      );
    }
    return execution;
  }

  private async loadLatestFailedStep(executionId: string) {
    const [step] = await this.db
      .select({
        attemptId: executionSteps.attemptId,
        stepId: executionSteps.stepId,
        stepIndex: executionSteps.stepIndex,
        error: executionSteps.error,
      })
      .from(executionSteps)
      .innerJoin(
        executionAttempts,
        eq(executionAttempts.id, executionSteps.attemptId),
      )
      .where(
        and(
          eq(executionSteps.executionId, executionId),
          eq(executionSteps.status, 'failed'),
        ),
      )
      .orderBy(desc(executionAttempts.attemptNumber))
      .limit(1);
    return step;
  }

  private async buildCheckpoint(
    executionId: string,
    attemptId: string,
    beforeStepIndex: number,
  ) {
    const [steps, [activeRecovery]] = await Promise.all([
      this.db
        .select({
          stepId: executionSteps.stepId,
          input: executionSteps.input,
          output: executionSteps.output,
        })
        .from(executionSteps)
        .where(
          and(
            eq(executionSteps.attemptId, attemptId),
            eq(executionSteps.status, 'succeeded'),
            lt(executionSteps.stepIndex, beforeStepIndex),
          ),
        )
        .orderBy(executionSteps.stepIndex),
      this.db
        .select({ checkpoint: executionRecoveries.checkpoint })
        .from(executions)
        .leftJoin(
          executionRecoveries,
          eq(executionRecoveries.id, executions.activeRecoveryId),
        )
        .where(eq(executions.id, executionId))
        .limit(1),
    ]);

    const checkpoint: {
      variables: Record<string, unknown>;
      steps: Record<string, { output: unknown }>;
    } = { variables: {}, steps: {} };
    if (
      this.isRecord(activeRecovery?.checkpoint) &&
      this.isRecord(activeRecovery.checkpoint.variables) &&
      this.isRecord(activeRecovery.checkpoint.steps)
    ) {
      Object.assign(checkpoint.variables, activeRecovery.checkpoint.variables);
      Object.assign(checkpoint.steps, activeRecovery.checkpoint.steps);
    }
    for (const step of steps) {
      checkpoint.steps[step.stepId] = { output: step.output };
      if (
        this.isRecord(step.input) &&
        step.input.type === 'transform' &&
        this.isRecord(step.output) &&
        this.isRecord(step.output.assigned)
      ) {
        Object.assign(checkpoint.variables, step.output.assigned);
      }
    }
    if (this.containsRedactedValue(checkpoint)) {
      throw new ConflictException(
        'A completed step contains redacted data and cannot be restored safely; replay this execution as new',
      );
    }
    return checkpoint;
  }

  private async scheduleRecovery(
    execution: {
      id: string;
      runSequence: number;
    },
    recovery: {
      operation: 'retry_failed_step' | 'resume';
      requestedBy: string;
      fromAttemptId: string;
      stepId: string;
      startStepIndex: number;
      checkpoint: unknown;
      resolutionOutput?: unknown;
    },
  ): Promise<RecoverExecutionResponse> {
    const result = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(executionRecoveries)
        .values({
          executionId: execution.id,
          ...recovery,
        })
        .returning({ id: executionRecoveries.id });
      const [updated] = await tx
        .update(executions)
        .set({
          status: 'pending',
          runSequence: sql`${executions.runSequence} + 1`,
          activeRecoveryId: created.id,
          failure: null,
          queuedAt: null,
          startedAt: null,
          completedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(eq(executions.id, execution.id), eq(executions.status, 'failed')),
        )
        .returning({ id: executions.id });
      if (!updated) throw new ConflictException('Execution state changed');

      await tx
        .update(executionOutbox)
        .set({
          status: 'pending',
          attempts: 0,
          nextAttemptAt: null,
          lastError: null,
          publishedAt: null,
        })
        .where(eq(executionOutbox.executionId, execution.id));
      return created;
    });

    return {
      recoveryId: result.id,
      executionId: execution.id,
      status: 'pending',
    };
  }

  private errorCode(value: unknown): string | undefined {
    return this.isRecord(value) && typeof value.code === 'string'
      ? value.code
      : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private containsRedactedValue(value: unknown): boolean {
    if (value === '[REDACTED]') return true;
    if (Array.isArray(value)) {
      return value.some((item) => this.containsRedactedValue(item));
    }
    if (!this.isRecord(value)) return false;
    return Object.values(value).some((item) =>
      this.containsRedactedValue(item),
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
    runSequence: number;
    replayedFromExecutionId: string | null;
    deadLetteredAt: Date | null;
    createdAt: Date;
  }): ExecutionSummary {
    return {
      ...row,
      status: row.status as ExecutionStatus,
      queuedAt: row.queuedAt?.toISOString() ?? null,
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      deadLetteredAt: row.deadLetteredAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
