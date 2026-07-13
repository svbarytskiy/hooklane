import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import type * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;
export type PostgresClient = postgres.Sql;
