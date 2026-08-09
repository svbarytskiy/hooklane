const UNIQUE_VIOLATION_CODE = '23505';

type PostgresErrorDetails = {
  code: string;
  constraint?: string;
};

export function getPostgresError(error: unknown): PostgresErrorDetails | null {
  let candidate = error;

  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof candidate !== 'object' || candidate === null) {
      return null;
    }

    if ('code' in candidate && typeof candidate.code === 'string') {
      return {
        code: candidate.code,
        constraint:
          'constraint' in candidate && typeof candidate.constraint === 'string'
            ? candidate.constraint
            : undefined,
      };
    }

    if (!('cause' in candidate)) {
      return null;
    }

    candidate = candidate.cause;
  }

  return null;
}

export function isUniqueViolation(error: unknown): boolean {
  return getPostgresError(error)?.code === UNIQUE_VIOLATION_CODE;
}

export function isUniqueConstraintViolation(
  error: unknown,
  constraint: string,
): boolean {
  const postgresError = getPostgresError(error);

  return (
    postgresError?.code === UNIQUE_VIOLATION_CODE &&
    postgresError.constraint === constraint
  );
}
