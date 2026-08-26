import type {
  EntitlementLimits,
  WorkspaceEntitlementResponse,
} from '@hooklane/contracts';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import {
  billingPlans,
  workspaceBillingAccounts,
  workspaceEntitlements,
} from 'src/database/schema';

@Injectable()
export class WorkspaceEntitlementsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async getEffectiveEntitlement(
    workspaceId: string,
  ): Promise<WorkspaceEntitlementResponse> {
    const [entitlement] = await this.db
      .select({
        workspaceId: workspaceEntitlements.workspaceId,
        billingOwnerUserId: workspaceBillingAccounts.billingOwnerUserId,
        planCode: billingPlans.code,
        planVersion: billingPlans.version,
        planName: billingPlans.name,
        maxPublishedWorkflows: billingPlans.maxPublishedWorkflows,
        maxIntegrations: billingPlans.maxIntegrations,
        maxExecutionsPerPeriod: billingPlans.maxExecutionsPerPeriod,
        maxConcurrentExecutions: billingPlans.maxConcurrentExecutions,
        executionRetentionDays: billingPlans.executionRetentionDays,
        source: workspaceEntitlements.source,
        status: workspaceEntitlements.status,
        currentPeriodStart: workspaceEntitlements.currentPeriodStart,
        currentPeriodEnd: workspaceEntitlements.currentPeriodEnd,
        graceEndsAt: workspaceEntitlements.graceEndsAt,
      })
      .from(workspaceEntitlements)
      .innerJoin(
        workspaceBillingAccounts,
        eq(
          workspaceBillingAccounts.workspaceId,
          workspaceEntitlements.workspaceId,
        ),
      )
      .innerJoin(
        billingPlans,
        eq(billingPlans.id, workspaceEntitlements.billingPlanId),
      )
      .where(eq(workspaceEntitlements.workspaceId, workspaceId))
      .limit(1);

    if (!entitlement) {
      throw new InternalServerErrorException(
        'Workspace billing entitlement is missing',
      );
    }

    const limits: EntitlementLimits = {
      maxPublishedWorkflows: entitlement.maxPublishedWorkflows,
      maxIntegrations: entitlement.maxIntegrations,
      maxExecutionsPerPeriod: entitlement.maxExecutionsPerPeriod,
      maxConcurrentExecutions: entitlement.maxConcurrentExecutions,
      executionRetentionDays: entitlement.executionRetentionDays,
    };

    return {
      workspaceId: entitlement.workspaceId,
      billingOwnerUserId: entitlement.billingOwnerUserId,
      plan: {
        code: entitlement.planCode,
        version: entitlement.planVersion,
        name: entitlement.planName,
        limits,
      },
      source: entitlement.source as WorkspaceEntitlementResponse['source'],
      status: entitlement.status as WorkspaceEntitlementResponse['status'],
      currentPeriodStart: entitlement.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: entitlement.currentPeriodEnd?.toISOString() ?? null,
      graceEndsAt: entitlement.graceEndsAt?.toISOString() ?? null,
    };
  }
}
