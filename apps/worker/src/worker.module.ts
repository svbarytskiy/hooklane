import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { validateWorkerEnv } from "./config/env";
import { WorkflowExecutionProcessor } from "./workflow-execution.processor";
import { WorkflowExecutionRunner } from "./workflow-execution.runner";
import { ConditionStepExecutor } from "./runtime/condition-step.executor";
import { DelayStepExecutor } from "./runtime/delay-step.executor";
import { ExpressionResolverService } from "./runtime/expression-resolver.service";
import { ExecutionDataSanitizerService } from "./runtime/execution-data-sanitizer.service";
import { HttpRequestStepExecutor } from "./runtime/http-request-step.executor";
import { HttpRequestPolicyService } from "./runtime/http-request-policy.service";
import { StepExecutorRegistry } from "./runtime/step-executor.registry";
import { TransformStepExecutor } from "./runtime/transform-step.executor";
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
    ExpressionResolverService,
    ExecutionDataSanitizerService,
    HttpRequestPolicyService,
    TransformStepExecutor,
    ConditionStepExecutor,
    DelayStepExecutor,
    HttpRequestStepExecutor,
    StepExecutorRegistry,
    WorkflowExecutionProcessor,
    WorkflowExecutionRunner,
  ],
})
export class WorkerModule {}
