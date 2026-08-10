import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof drizzle<typeof schema>>;
export type PostgresClient = postgres.Sql;

export function createDatabaseConnection(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 5 });
  const db = drizzle(client, { schema });

  return { client, db };
}
