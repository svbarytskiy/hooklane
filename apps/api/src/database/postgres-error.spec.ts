import {
  getPostgresError,
  isUniqueConstraintViolation,
  isUniqueViolation,
} from './postgres-error';

describe('Postgres error helpers', () => {
  it('recognizes a direct unique-violation error', () => {
    const error = {
      code: '23505',
      constraint: 'workspaces_slug_unique',
    };

    expect(isUniqueViolation(error)).toBe(true);
    expect(isUniqueConstraintViolation(error, 'workspaces_slug_unique')).toBe(
      true,
    );
  });

  it('recognizes a Postgres error wrapped by an ORM cause', () => {
    const error = {
      cause: {
        code: '23505',
        constraint: 'webhook_endpoints_workflow_name_unique',
      },
    };

    expect(isUniqueViolation(error)).toBe(true);
    expect(
      isUniqueConstraintViolation(
        error,
        'webhook_endpoints_workflow_name_unique',
      ),
    ).toBe(true);
  });

  it('does not classify another Postgres error as a unique violation', () => {
    const error = { code: '23503', constraint: 'payments_user_id_fkey' };

    expect(getPostgresError(error)).toEqual(error);
    expect(isUniqueViolation(error)).toBe(false);
    expect(isUniqueConstraintViolation(error, 'payments_user_id_fkey')).toBe(
      false,
    );
  });

  it('returns null for non-database errors', () => {
    expect(getPostgresError(new Error('Network failure'))).toBeNull();
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
