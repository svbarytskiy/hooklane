import { Redis } from "ioredis";

/**
 * Creates a Redis connection for BullMQ queues and workers.
 *
 * BullMQ requires maxRetriesPerRequest to be null because a worker may keep
 * waiting for Redis instead of failing an individual command after a short
 * ioredis retry window. This connection is lazy so importing the queue module
 * does not open a network connection before the process starts.
 */
export function createBullMqRedisConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });
}
