import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Env } from '../config/env.schema';
import { DATABASE, POSTGRES_CLIENT } from './database.tokens';
import * as schema from './schema';
import type { Database, PostgresClient } from './database.types';

@Module({
  providers: [
    {
      provide: POSTGRES_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): PostgresClient => {
        return postgres(config.get('DATABASE_URL', { infer: true }));
      },
    },
    {
      provide: DATABASE,
      inject: [POSTGRES_CLIENT],
      useFactory: (client: PostgresClient): Database => {
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DATABASE, POSTGRES_CLIENT],
})
export class DatabaseModule {}
