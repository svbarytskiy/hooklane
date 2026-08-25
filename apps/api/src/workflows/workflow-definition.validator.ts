import type { WorkflowValidationError } from '@hooklane/contracts';

const supportedStepTypes = new Set([
  'http_request',
  'transform',
  'condition',
  'delay',
  'slack_send_message',
]);
const supportedHttpMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const httpHeaderNamePattern = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const unsafeRuntimePathSegments = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

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

  if (config.idempotency !== undefined) {
    if (!isRecord(config.idempotency)) {
      errors.push({
        path: `${path}.idempotency`,
        code: 'invalid_type',
        message: 'HTTP idempotency configuration must be an object',
      });
      return;
    }

    if (config.idempotency.mode !== 'execution_step') {
      errors.push({
        path: `${path}.idempotency.mode`,
        code: 'invalid_value',
        message: 'HTTP idempotency mode must be execution_step',
      });
    }

    const headerName = config.idempotency.headerName;
    if (
      headerName !== undefined &&
      (typeof headerName !== 'string' ||
        headerName.length > 100 ||
        !httpHeaderNamePattern.test(headerName))
    ) {
      errors.push({
        path: `${path}.idempotency.headerName`,
        code: 'invalid_value',
        message: 'Idempotency header name must be a valid HTTP header name',
      });
    }

    if (
      isRecord(config.headers) &&
      Object.keys(config.headers).some(
        (name) =>
          name.toLowerCase() ===
          (typeof headerName === 'string' && headerName
            ? headerName
            : 'Idempotency-Key'
          ).toLowerCase(),
      )
    ) {
      errors.push({
        path: `${path}.headers`,
        code: 'conflict',
        message: 'Hooklane-managed idempotency header must not be set manually',
      });
    }
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

  for (const assignmentPath of Object.keys(config.assignments)) {
    const segments = assignmentPath.split('.');
    if (
      segments.some(
        (segment) =>
          segment.length === 0 || unsafeRuntimePathSegments.has(segment),
      )
    ) {
      errors.push({
        path: `${path}.assignments.${assignmentPath}`,
        code: 'invalid_value',
        message: 'Transform assignment path is empty or unsafe',
      });
    }
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

function validateDelayConfig(
  config: Record<string, unknown>,
  path: string,
  errors: WorkflowValidationError[],
) {
  if (
    typeof config.durationMs !== 'number' ||
    !Number.isInteger(config.durationMs) ||
    config.durationMs < 1 ||
    config.durationMs > 300_000
  ) {
    errors.push({
      path: `${path}.durationMs`,
      code: 'invalid_value',
      message: 'Delay duration must be an integer between 1 and 300000 ms',
    });
  }
}

function validateSlackSendMessageConfig(
  config: Record<string, unknown>,
  path: string,
  errors: WorkflowValidationError[],
) {
  if (
    typeof config.connectionId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      config.connectionId,
    )
  ) {
    errors.push({
      path: `${path}.connectionId`,
      code: 'invalid_value',
      message: 'Slack connection id must be a UUID',
    });
  }

  if (
    typeof config.channel !== 'string' ||
    !/^[CGD][A-Z0-9]{8,}$/.test(config.channel.trim())
  ) {
    errors.push({
      path: `${path}.channel`,
      code: 'invalid_value',
      message: 'Slack channel must be a channel, group, or DM ID',
    });
  }

  if (
    typeof config.text !== 'string' ||
    config.text.trim().length === 0 ||
    config.text.length > 4_000
  ) {
    errors.push({
      path: `${path}.text`,
      code: 'invalid_value',
      message: 'Slack message text must contain 1 to 4000 characters',
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

    if (step.type === 'delay') {
      validateDelayConfig(step.config, `${path}.config`, errors);
    }

    if (step.type === 'slack_send_message') {
      validateSlackSendMessageConfig(step.config, `${path}.config`, errors);
    }
  });

  return errors;
}
