import type { WorkflowValidationError } from '@hooklane/contracts';

const supportedStepTypes = new Set(['http_request', 'transform', 'condition']);
const supportedHttpMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateHttpRequestConfig(
  config: Record<string, unknown>,
  path: string,
  errors: WorkflowValidationError[],
) {
  if (typeof config.url !== 'string' || !isHttpUrl(config.url)) {
    errors.push({
      path: `${path}.url`,
      code: 'invalid_value',
      message: 'HTTP request url must be an absolute http or https URL',
    });
  }

  if (
    typeof config.method !== 'string' ||
    !supportedHttpMethods.has(config.method)
  ) {
    errors.push({
      path: `${path}.method`,
      code: 'invalid_value',
      message: 'HTTP request method must be GET, POST, PUT, PATCH, or DELETE',
    });
  }

  if (
    config.headers !== undefined &&
    (!isRecord(config.headers) ||
      Object.values(config.headers).some((value) => typeof value !== 'string'))
  ) {
    errors.push({
      path: `${path}.headers`,
      code: 'invalid_type',
      message: 'HTTP request headers must be a string-to-string object',
    });
  }
}

function validateTransformConfig(
  config: Record<string, unknown>,
  path: string,
  errors: WorkflowValidationError[],
) {
  if (
    !isRecord(config.assignments) ||
    Object.keys(config.assignments).length === 0
  ) {
    errors.push({
      path: `${path}.assignments`,
      code: 'required',
      message: 'Transform step requires at least one assignment',
    });
    return;
  }

  if (
    Object.values(config.assignments).some((value) => typeof value !== 'string')
  ) {
    errors.push({
      path: `${path}.assignments`,
      code: 'invalid_type',
      message: 'Transform assignments must map field names to expressions',
    });
  }
}

function validateConditionConfig(
  config: Record<string, unknown>,
  path: string,
  errors: WorkflowValidationError[],
) {
  if (
    typeof config.expression !== 'string' ||
    config.expression.trim().length === 0
  ) {
    errors.push({
      path: `${path}.expression`,
      code: 'required',
      message: 'Condition step requires an expression',
    });
  }
}

export function validateWorkflowDefinition(
  definition: unknown,
): WorkflowValidationError[] {
  if (!isRecord(definition)) {
    return [
      {
        path: 'definition',
        code: 'invalid_type',
        message: 'Definition must be an object',
      },
    ];
  }

  if (!Array.isArray(definition.steps)) {
    return [
      {
        path: 'steps',
        code: 'invalid_type',
        message: 'Steps must be an array',
      },
    ];
  }

  if (definition.steps.length === 0) {
    return [
      {
        path: 'steps',
        code: 'min_length',
        message: 'Workflow must contain at least one step',
      },
    ];
  }

  const errors: WorkflowValidationError[] = [];
  const stepIds = new Set<string>();

  definition.steps.forEach((step, index) => {
    const path = `steps[${index}]`;

    if (!isRecord(step)) {
      errors.push({
        path,
        code: 'invalid_type',
        message: 'Step must be an object',
      });
      return;
    }

    if (typeof step.id !== 'string' || step.id.trim().length === 0) {
      errors.push({
        path: `${path}.id`,
        code: 'required',
        message: 'Step id is required',
      });
    } else if (stepIds.has(step.id)) {
      errors.push({
        path: `${path}.id`,
        code: 'duplicate',
        message: 'Step ids must be unique',
      });
    } else {
      stepIds.add(step.id);
    }

    if (typeof step.type !== 'string' || !supportedStepTypes.has(step.type)) {
      errors.push({
        path: `${path}.type`,
        code: 'unsupported',
        message: 'Step type is not supported',
      });
    }

    if (typeof step.name !== 'string' || step.name.trim().length === 0) {
      errors.push({
        path: `${path}.name`,
        code: 'required',
        message: 'Step name is required',
      });
    }

    if (!isRecord(step.config)) {
      errors.push({
        path: `${path}.config`,
        code: 'invalid_type',
        message: 'Step config must be an object',
      });
      return;
    }

    if (step.type === 'http_request') {
      validateHttpRequestConfig(step.config, `${path}.config`, errors);
    }

    if (step.type === 'transform') {
      validateTransformConfig(step.config, `${path}.config`, errors);
    }

    if (step.type === 'condition') {
      validateConditionConfig(step.config, `${path}.config`, errors);
    }
  });

  return errors;
}
