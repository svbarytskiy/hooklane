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
      ],
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'steps[0].config.url' }),
        expect.objectContaining({ path: 'steps[0].config.method' }),
        expect.objectContaining({ path: 'steps[1].config.assignments' }),
        expect.objectContaining({ path: 'steps[2].config.expression' }),
      ]),
    );
  });
});
