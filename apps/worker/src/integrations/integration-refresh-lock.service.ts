import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import type { WorkerEnv } from "../config/env.schema";

const LOCK_TTL_MS = 30_000;
const RELEASE_IF_OWNED_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

@Injectable()
export class IntegrationRefreshLockService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(config: ConfigService<WorkerEnv, true>) {
    this.redis = new Redis(config.get("REDIS_URL", { infer: true }), {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });
  }

  async tryAcquire(
    connectionId: string,
  ): Promise<(() => Promise<void>) | null> {
    const key = `hooklane:integration-refresh:${connectionId}`;
    const token = randomUUID();
    const acquired = await this.redis.set(key, token, "PX", LOCK_TTL_MS, "NX");
    if (acquired !== "OK") return null;

    return async () => {
      await this.redis.eval(RELEASE_IF_OWNED_SCRIPT, 1, key, token);
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
