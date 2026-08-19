import { validateWorkflowDefinition } from './workflow-definition.validator';

describe('validateWorkflowDefinition', () => {
  const validDefinition = {
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
  };

  it('accepts an ordered list of supported, well-formed steps', () => {
    expect(validateWorkflowDefinition(validDefinition)).toEqual([]);
  });

  it('requires at least one step before publishing', () => {
    expect(validateWorkflowDefinition({ steps: [] })).toEqual([
      expect.objectContaining({ path: 'steps', code: 'min_length' }),
    ]);
  });

  it('reports duplicate ids and unsupported step types', () => {
    const errors = validateWorkflowDefinition({
      steps: [
        ...validDefinition.steps,
        {
          id: 'request-order',
          type: 'queue_magic',
          name: '',
          config: null,
        },
      ],
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'steps[1].id', code: 'duplicate' }),
        expect.objectContaining({ path: 'steps[1].type', code: 'unsupported' }),
        expect.objectContaining({ path: 'steps[1].name', code: 'required' }),
        expect.objectContaining({
          path: 'steps[1].config',
          code: 'invalid_type',
        }),
      ]),
    );
  });

  it('validates step-type-specific configuration', () => {
    const errors = validateWorkflowDefinition({
      steps: [
        {
          id: 'request-order',
          type: 'http_request',
          name: 'Send order',
          config: { url: '/orders', method: 'FETCH' },
        },
        {
          id: 'transform-order',
          type: 'transform',
          name: 'Map order',
          config: { assignments: {} },
        },
        {
          id: 'is-priority',
          type: 'condition',
          name: 'Priority order?',
          config: { expression: '  ' },
        },
        {
          id: 'delay',
          type: 'delay',
          name: 'Wait',
          config: { durationMs: 0 },
        },
      ],
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'steps[0].config.url' }),
        expect.objectContaining({ path: 'steps[0].config.method' }),
        expect.objectContaining({ path: 'steps[1].config.assignments' }),
        expect.objectContaining({ path: 'steps[2].config.expression' }),
        expect.objectContaining({ path: 'steps[3].config.durationMs' }),
      ]),
    );
  });

  it('validates provider idempotency configuration and header ownership', () => {
    const invalidConfiguration = validateWorkflowDefinition({
      steps: [
        {
          ...validDefinition.steps[0],
          config: {
            ...validDefinition.steps[0].config,
            headers: { 'Idempotency-Key': 'manual-value' },
            idempotency: { mode: 'execution_step' },
          },
        },
      ],
    });
    const invalidHeader = validateWorkflowDefinition({
      steps: [
        {
          ...validDefinition.steps[0],
          config: {
            ...validDefinition.steps[0].config,
            idempotency: {
              mode: 'execution_step',
              headerName: 'not a header',
            },
          },
        },
      ],
    });

    expect(invalidConfiguration).toEqual([
      expect.objectContaining({
        path: 'steps[0].config.headers',
        code: 'conflict',
      }),
    ]);
    expect(invalidHeader).toEqual([
      expect.objectContaining({
        path: 'steps[0].config.idempotency.headerName',
        code: 'invalid_value',
      }),
    ]);
  });

  it('rejects transform paths that could modify object prototypes', () => {
    const errors = validateWorkflowDefinition({
      steps: [
        {
          id: 'unsafe-transform',
          type: 'transform',
          name: 'Unsafe transform',
          config: {
            assignments: { '__proto__.isAdmin': 'true' },
          },
        },
      ],
    });

    expect(errors).toEqual([
      expect.objectContaining({
        path: 'steps[0].config.assignments.__proto__.isAdmin',
        code: 'invalid_value',
      }),
    ]);
  });
});
