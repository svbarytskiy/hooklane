import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import {
  workflowAuditRecords,
  workflowVersions,
  workflows,
} from 'src/database/schema';
import { validateWorkflowDefinition } from './workflow-definition.validator';

@Injectable()
export class WorkflowsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
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
      if (this.isUniqueViolation(error)) {
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

      const errors = validateWorkflowDefinition(draft.definition);

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

      const errors = validateWorkflowDefinition(draft.definition);

      if (errors.length > 0) {
        await tx
          .update(workflowVersions)
          .set({ validationErrors: errors, updatedAt: new Date() })
          .where(eq(workflowVersions.id, draft.id));

        return { errors };
      }

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

  private isUniqueViolation(error: unknown): boolean {
    const cause =
      typeof error === 'object' && error !== null && 'cause' in error
        ? ((error as { cause?: unknown }).cause ?? error)
        : error;

    return (
      typeof cause === 'object' &&
      cause !== null &&
      'code' in cause &&
      cause.code === '23505'
    );
  }
}
