import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { validateWorkerEnv } from "./config/env";
import { WorkflowExecutionProcessor } from "./workflow-execution.processor";
import { WorkflowExecutionRunner } from "./workflow-execution.runner";
import {
  createWorkerPostgresClient,
  WORKER_POSTGRES_CLIENT,
  WorkerDatabaseService,
} from "./database/worker-database.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["apps/worker/.env.local", ".env.local", ".env"],
      validate: validateWorkerEnv,
    }),
  ],
  providers: [
    {
      provide: WORKER_POSTGRES_CLIENT,
      inject: [ConfigService],
      useFactory: createWorkerPostgresClient,
    },
    WorkerDatabaseService,
    WorkflowExecutionProcessor,
    WorkflowExecutionRunner,
  ],
})
export class WorkerModule {}
