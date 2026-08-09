import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service';

describe('WorkflowsService', () => {
  const workspaceId = '00000000-0000-4000-8000-000000000001';
  const userId = '00000000-0000-4000-8000-000000000002';
  const workflow = {
    id: '00000000-0000-4000-8000-000000000003',
    workspaceId,
    name: 'Order created',
    slug: 'order-created',
    status: 'active',
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const draft = {
    id: '00000000-0000-4000-8000-000000000004',
    workflowId: workflow.id,
    versionNumber: 1,
    state: 'draft',
    definition: { steps: [] },
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('creates a workflow, its first draft, and an audit record atomically', async () => {
    const workflowInsert = {
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([workflow]),
      }),
    };
    const draftInsert = {
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([draft]),
      }),
    };
    const auditInsert = { values: jest.fn().mockResolvedValue([]) };
    const transaction = {
      insert: jest
        .fn()
        .mockReturnValueOnce(workflowInsert)
        .mockReturnValueOnce(draftInsert)
        .mockReturnValueOnce(auditInsert),
    };
    const db = {
      transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new WorkflowsService(db as never);

    await expect(
      service.createWorkflow(userId, workspaceId, workflow.name, workflow.slug),
    ).resolves.toEqual({ ...workflow, draft });

    expect(workflowInsert.values).toHaveBeenCalledWith({
      workspaceId,
      name: workflow.name,
      slug: workflow.slug,
      createdBy: userId,
    });
    expect(draftInsert.values).toHaveBeenCalledWith({
      workflowId: workflow.id,
      versionNumber: 1,
      state: 'draft',
      definition: { steps: [] },
      createdBy: userId,
    });
    expect(auditInsert.values).toHaveBeenCalledWith({
      workspaceId,
      workflowId: workflow.id,
      actorId: userId,
      eventType: 'workflow_created',
      metadata: { versionNumber: 1 },
    });
  });

  it('maps duplicate workflow slugs to ConflictException', async () => {
    const db = {
      transaction: jest.fn().mockRejectedValue({ code: '23505' }),
    };
    const service = new WorkflowsService(db as never);

    await expect(
      service.createWorkflow(userId, workspaceId, workflow.name, workflow.slug),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists workflows scoped to the requested workspace', async () => {
    const rows = [workflow];
    const orderBy = jest.fn().mockResolvedValue(rows);
    const where = jest.fn().mockReturnValue({ orderBy });
    const from = jest.fn().mockReturnValue({ where });
    const db = { select: jest.fn().mockReturnValue({ from }) };
    const service = new WorkflowsService(db as never);

    await expect(service.listWorkflows(workspaceId)).resolves.toEqual(rows);
    expect(where).toHaveBeenCalledTimes(1);
  });

  it('does not reveal a workflow outside the requested workspace', async () => {
    const limit = jest.fn().mockResolvedValue([]);
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    const db = { select: jest.fn().mockReturnValue({ from }) };
    const service = new WorkflowsService(db as never);

    await expect(
      service.getWorkflow(workspaceId, '00000000-0000-4000-8000-000000000005'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the active workflow draft scoped to the workspace', async () => {
    const limit = jest.fn().mockResolvedValue([draft]);
    const where = jest.fn().mockReturnValue({ limit });
    const innerJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ innerJoin });
    const db = { select: jest.fn().mockReturnValue({ from }) };
    const service = new WorkflowsService(db as never);

    await expect(service.getDraft(workspaceId, workflow.id)).resolves.toEqual(
      draft,
    );
    expect(where).toHaveBeenCalledTimes(1);
  });

  it('lists version history only after confirming workspace access', async () => {
    const versions = [
      { ...draft, versionNumber: 2 },
      { ...draft, versionNumber: 1, state: 'published' },
    ];
    const orderBy = jest.fn().mockResolvedValue(versions);
    const where = jest.fn().mockReturnValue({ orderBy });
    const from = jest.fn().mockReturnValue({ where });
    const db = { select: jest.fn().mockReturnValue({ from }) };
    const service = new WorkflowsService(db as never);
    const getWorkflowSpy = jest
      .spyOn(service, 'getWorkflow')
      .mockResolvedValue(workflow);

    await expect(
      service.listVersions(workspaceId, workflow.id),
    ).resolves.toEqual(versions);
    expect(getWorkflowSpy).toHaveBeenCalledWith(workspaceId, workflow.id);
    expect(where).toHaveBeenCalledTimes(1);
  });

  it('updates a draft and records the change atomically', async () => {
    const draftSelect = {
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([draft]),
          }),
        }),
      }),
    };
    const updatedDraft = {
      ...draft,
      definition: { steps: [{ id: 'step-1' }] },
    };
    const update = {
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([updatedDraft]),
        }),
      }),
    };
    const auditInsert = { values: jest.fn().mockResolvedValue([]) };
    const transaction = {
      select: jest.fn().mockReturnValue(draftSelect),
      update: jest.fn().mockReturnValue(update),
      insert: jest.fn().mockReturnValue(auditInsert),
    };
    const db = {
      transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new WorkflowsService(db as never);

    await expect(
      service.updateDraft(
        userId,
        workspaceId,
        workflow.id,
        updatedDraft.definition,
      ),
    ).resolves.toEqual(updatedDraft);

    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        definition: updatedDraft.definition,
        validationErrors: null,
      }),
    );
    expect(auditInsert.values).toHaveBeenCalledWith({
      workspaceId,
      workflowId: workflow.id,
      actorId: userId,
      eventType: 'draft_updated',
      metadata: { versionNumber: 1 },
    });
  });

  it('validates a draft and persists its validation result', async () => {
    const invalidDraft = { ...draft, definition: { steps: [] } };
    const update = {
      set: jest
        .fn()
        .mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
    };
    const transaction = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([invalidDraft]),
            }),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue(update),
    };
    const db = {
      transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new WorkflowsService(db as never);

    await expect(
      service.validateDraft(workspaceId, workflow.id),
    ).resolves.toEqual({
      isValid: false,
      errors: [expect.objectContaining({ path: 'steps', code: 'min_length' })],
    });
    expect(update.set).toHaveBeenCalledTimes(1);
  });

  it('publishes a valid draft and creates the next editable draft', async () => {
    const validDraft = {
      ...draft,
      definition: {
        steps: [
          {
            id: 'request-order',
            type: 'http_request',
            name: 'Send order',
            config: {
              url: 'https://example.test/orders',
              method: 'POST',
            },
          },
        ],
      },
    };
    const publishedVersion = { ...validDraft, state: 'published' };
    const nextDraft = {
      ...validDraft,
      id: '00000000-0000-4000-8000-000000000006',
      versionNumber: 2,
    };
    const publishUpdate = {
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([publishedVersion]),
        }),
      }),
    };
    const nextDraftInsert = {
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([nextDraft]),
      }),
    };
    const auditInsert = { values: jest.fn().mockResolvedValue([]) };
    const transaction = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([validDraft]),
            }),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue(publishUpdate),
      insert: jest
        .fn()
        .mockReturnValueOnce(nextDraftInsert)
        .mockReturnValueOnce(auditInsert),
    };
    const db = {
      transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new WorkflowsService(db as never);

    await expect(
      service.publishWorkflow(userId, workspaceId, workflow.id),
    ).resolves.toEqual({ publishedVersion, nextDraft });

    expect(nextDraftInsert.values).toHaveBeenCalledWith({
      workflowId: workflow.id,
      versionNumber: 2,
      state: 'draft',
      definition: validDraft.definition,
      createdBy: userId,
    });
    expect(auditInsert.values).toHaveBeenCalledWith({
      workspaceId,
      workflowId: workflow.id,
      actorId: userId,
      eventType: 'workflow_published',
      metadata: {
        publishedVersionNumber: 1,
        nextDraftVersionNumber: 2,
      },
    });
  });

  it('rejects publishing an invalid draft after persisting its errors', async () => {
    const invalidDraft = { ...draft, definition: { steps: [] } };
    const update = {
      set: jest
        .fn()
        .mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
    };
    const transaction = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([invalidDraft]),
            }),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue(update),
    };
    const db = {
      transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new WorkflowsService(db as never);

    await expect(
      service.publishWorkflow(userId, workspaceId, workflow.id),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(update.set).toHaveBeenCalledTimes(1);
  });

  it('archives an active workflow and records the event', async () => {
    const archivedWorkflow = { ...workflow, status: 'archived' };
    const update = {
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([archivedWorkflow]),
        }),
      }),
    };
    const auditInsert = { values: jest.fn().mockResolvedValue([]) };
    const transaction = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([workflow]),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue(update),
      insert: jest.fn().mockReturnValue(auditInsert),
    };
    const db = {
      transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new WorkflowsService(db as never);

    await expect(
      service.archiveWorkflow(userId, workspaceId, workflow.id),
    ).resolves.toEqual(archivedWorkflow);
    expect(auditInsert.values).toHaveBeenCalledWith({
      workspaceId,
      workflowId: workflow.id,
      actorId: userId,
      eventType: 'workflow_archived',
      metadata: {},
    });
  });

  it('rejects archiving a workflow twice', async () => {
    const transaction = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest
              .fn()
              .mockResolvedValue([{ ...workflow, status: 'archived' }]),
          }),
        }),
      }),
    };
    const db = {
      transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new WorkflowsService(db as never);

    await expect(
      service.archiveWorkflow(userId, workspaceId, workflow.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
