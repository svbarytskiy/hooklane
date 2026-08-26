import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  WorkflowDefinition,
  WorkflowValidationError,
} from '@hooklane/contracts';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { isUniqueViolation } from 'src/database/postgres-error';
import {
  workflowAuditRecords,
  workflowVersions,
  workflows,
  integrationConnections,
} from 'src/database/schema';
import { validateWorkflowDefinition } from './workflow-definition.validator';
import { WorkspaceQuotaService } from 'src/entitlements/workspace-quota.service';

@Injectable()
export class WorkflowsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    private readonly workspaceQuota: WorkspaceQuotaService = new WorkspaceQuotaService(),
  ) {}

  async createWorkflow(
    userId: string,
    workspaceId: string,
    name: string,
    slug: string,
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        const [workflow] = await tx
          .insert(workflows)
          .values({ workspaceId, name, slug, createdBy: userId })
          .returning();

        if (!workflow) {
          throw new Error('Workflow was not created');
        }

        const [draft] = await tx
          .insert(workflowVersions)
          .values({
            workflowId: workflow.id,
            versionNumber: 1,
            state: 'draft',
            definition: { steps: [] },
            createdBy: userId,
          })
          .returning();

        if (!draft) {
          throw new Error('Workflow draft was not created');
        }

        await tx.insert(workflowAuditRecords).values({
          workspaceId,
          workflowId: workflow.id,
          actorId: userId,
          eventType: 'workflow_created',
          metadata: { versionNumber: draft.versionNumber },
        });

        return { ...workflow, draft };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Workflow slug already exists in this workspace',
        );
      }

      throw error;
    }
  }

  async listWorkflows(workspaceId: string) {
    return this.db
      .select({
        id: workflows.id,
        name: workflows.name,
        slug: workflows.slug,
        status: workflows.status,
        createdAt: workflows.createdAt,
        updatedAt: workflows.updatedAt,
      })
      .from(workflows)
      .where(eq(workflows.workspaceId, workspaceId))
      .orderBy(desc(workflows.createdAt));
  }

  async getWorkflow(workspaceId: string, workflowId: string) {
    const [workflow] = await this.db
      .select({
        id: workflows.id,
        name: workflows.name,
        slug: workflows.slug,
        status: workflows.status,
        createdAt: workflows.createdAt,
        updatedAt: workflows.updatedAt,
      })
      .from(workflows)
      .where(
        and(
          eq(workflows.id, workflowId),
          eq(workflows.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  async getDraft(workspaceId: string, workflowId: string) {
    const [draft] = await this.db
      .select({
        id: workflowVersions.id,
        workflowId: workflowVersions.workflowId,
        versionNumber: workflowVersions.versionNumber,
        state: workflowVersions.state,
        definition: workflowVersions.definition,
        validationErrors: workflowVersions.validationErrors,
        updatedAt: workflowVersions.updatedAt,
      })
      .from(workflowVersions)
      .innerJoin(workflows, eq(workflowVersions.workflowId, workflows.id))
      .where(
        and(
          eq(workflowVersions.workflowId, workflowId),
          eq(workflowVersions.state, 'draft'),
          eq(workflows.workspaceId, workspaceId),
          eq(workflows.status, 'active'),
        ),
      )
      .limit(1);

    if (!draft) {
      throw new NotFoundException('Workflow draft not found');
    }

    return draft;
  }

  async listVersions(workspaceId: string, workflowId: string) {
    await this.getWorkflow(workspaceId, workflowId);

    return this.db
      .select({
        id: workflowVersions.id,
        versionNumber: workflowVersions.versionNumber,
        state: workflowVersions.state,
        publishedAt: workflowVersions.publishedAt,
        createdAt: workflowVersions.createdAt,
        updatedAt: workflowVersions.updatedAt,
      })
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, workflowId))
      .orderBy(desc(workflowVersions.versionNumber));
  }

  async updateDraft(
    userId: string,
    workspaceId: string,
    workflowId: string,
    definition: unknown,
  ) {
    return this.db.transaction(async (tx) => {
      const [draft] = await tx
        .select({
          id: workflowVersions.id,
          versionNumber: workflowVersions.versionNumber,
        })
        .from(workflowVersions)
        .innerJoin(workflows, eq(workflowVersions.workflowId, workflows.id))
        .where(
          and(
            eq(workflowVersions.workflowId, workflowId),
            eq(workflowVersions.state, 'draft'),
            eq(workflows.workspaceId, workspaceId),
            eq(workflows.status, 'active'),
          ),
        )
        .limit(1);

      if (!draft) {
        throw new NotFoundException('Workflow draft not found');
      }

      const [updatedDraft] = await tx
        .update(workflowVersions)
        .set({
          definition,
          validationErrors: null,
          updatedAt: new Date(),
        })
        .where(eq(workflowVersions.id, draft.id))
        .returning();

      if (!updatedDraft) {
        throw new Error('Workflow draft was not updated');
      }

      await tx.insert(workflowAuditRecords).values({
        workspaceId,
        workflowId,
        actorId: userId,
        eventType: 'draft_updated',
        metadata: { versionNumber: draft.versionNumber },
      });

      return updatedDraft;
    });
  }

  async validateDraft(workspaceId: string, workflowId: string) {
    return this.db.transaction(async (tx) => {
      const [draft] = await tx
        .select({
          id: workflowVersions.id,
          definition: workflowVersions.definition,
        })
        .from(workflowVersions)
        .innerJoin(workflows, eq(workflowVersions.workflowId, workflows.id))
        .where(
          and(
            eq(workflowVersions.workflowId, workflowId),
            eq(workflowVersions.state, 'draft'),
            eq(workflows.workspaceId, workspaceId),
            eq(workflows.status, 'active'),
          ),
        )
        .limit(1);

      if (!draft) {
        throw new NotFoundException('Workflow draft not found');
      }

      const errors = await this.validateDefinition(
        tx,
        workspaceId,
        draft.definition,
      );

      await tx
        .update(workflowVersions)
        .set({ validationErrors: errors, updatedAt: new Date() })
        .where(eq(workflowVersions.id, draft.id));

      return { isValid: errors.length === 0, errors };
    });
  }

  async publishWorkflow(
    userId: string,
    workspaceId: string,
    workflowId: string,
  ) {
    const result = await this.db.transaction(async (tx) => {
      const [draft] = await tx
        .select({
          id: workflowVersions.id,
          versionNumber: workflowVersions.versionNumber,
          definition: workflowVersions.definition,
        })
        .from(workflowVersions)
        .innerJoin(workflows, eq(workflowVersions.workflowId, workflows.id))
        .where(
          and(
            eq(workflowVersions.workflowId, workflowId),
            eq(workflowVersions.state, 'draft'),
            eq(workflows.workspaceId, workspaceId),
            eq(workflows.status, 'active'),
          ),
        )
        .limit(1);

      if (!draft) {
        throw new NotFoundException('Workflow draft not found');
      }

      const errors = await this.validateDefinition(
        tx,
        workspaceId,
        draft.definition,
      );

      if (errors.length > 0) {
        await tx
          .update(workflowVersions)
          .set({ validationErrors: errors, updatedAt: new Date() })
          .where(eq(workflowVersions.id, draft.id));

        return { errors };
      }

      await this.workspaceQuota.assertCanPublishWorkflow(
        tx,
        workspaceId,
        workflowId,
      );

      const publishedAt = new Date();
      const [publishedVersion] = await tx
        .update(workflowVersions)
        .set({
          state: 'published',
          publishedAt,
          validationErrors: [],
          updatedAt: publishedAt,
        })
        .where(eq(workflowVersions.id, draft.id))
        .returning();

      if (!publishedVersion) {
        throw new Error('Workflow version was not published');
      }

      const [nextDraft] = await tx
        .insert(workflowVersions)
        .values({
          workflowId,
          versionNumber: draft.versionNumber + 1,
          state: 'draft',
          definition: draft.definition,
          createdBy: userId,
        })
        .returning();

      if (!nextDraft) {
        throw new Error('Next workflow draft was not created');
      }

      await tx.insert(workflowAuditRecords).values({
        workspaceId,
        workflowId,
        actorId: userId,
        eventType: 'workflow_published',
        metadata: {
          publishedVersionNumber: draft.versionNumber,
          nextDraftVersionNumber: nextDraft.versionNumber,
        },
      });

      return { publishedVersion, nextDraft };
    });

    if ('errors' in result) {
      throw new UnprocessableEntityException({
        message: 'Workflow draft is invalid',
        errors: result.errors,
      });
    }

    return result;
  }

  async archiveWorkflow(
    userId: string,
    workspaceId: string,
    workflowId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [workflow] = await tx
        .select({ id: workflows.id, status: workflows.status })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, workflowId),
            eq(workflows.workspaceId, workspaceId),
          ),
        )
        .limit(1);

      if (!workflow) {
        throw new NotFoundException('Workflow not found');
      }

      if (workflow.status === 'archived') {
        throw new ConflictException('Workflow is already archived');
      }

      const [archivedWorkflow] = await tx
        .update(workflows)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(workflows.id, workflow.id))
        .returning();

      if (!archivedWorkflow) {
        throw new Error('Workflow was not archived');
      }

      await tx.insert(workflowAuditRecords).values({
        workspaceId,
        workflowId,
        actorId: userId,
        eventType: 'workflow_archived',
        metadata: {},
      });

      return archivedWorkflow;
    });
  }

  private async validateDefinition(
    tx: Database,
    workspaceId: string,
    definition: unknown,
  ): Promise<WorkflowValidationError[]> {
    const errors = validateWorkflowDefinition(definition);
    if (errors.length > 0) return errors;

    const workflow = definition as WorkflowDefinition;
    const slackSteps = workflow.steps
      .map((step, index) => ({ step, index }))
      .filter(
        (
          item,
        ): item is {
          step: Extract<
            WorkflowDefinition['steps'][number],
            {
              type: 'slack_send_message';
            }
          >;
          index: number;
        } => item.step.type === 'slack_send_message',
      );
    if (slackSteps.length === 0) return errors;

    const connectionIds = [
      ...new Set(slackSteps.map(({ step }) => step.config.connectionId)),
    ];
    const connections = await tx
      .select({ id: integrationConnections.id })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.workspaceId, workspaceId),
          eq(integrationConnections.provider, 'slack'),
          eq(integrationConnections.status, 'active'),
          inArray(integrationConnections.id, connectionIds),
        ),
      );
    const activeConnectionIds = new Set(
      connections.map((connection) => connection.id),
    );

    for (const { step, index } of slackSteps) {
      if (!activeConnectionIds.has(step.config.connectionId)) {
        errors.push({
          path: `steps[${index}].config.connectionId`,
          code: 'invalid_value',
          message:
            'Slack connection does not exist or is not active in this workspace',
        });
      }
    }
    return errors;
  }
}
