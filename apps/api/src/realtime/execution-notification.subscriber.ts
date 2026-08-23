import {
  EXECUTION_NOTIFICATIONS_CHANNEL,
  isExecutionNotificationV1,
} from '@hooklane/contracts';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisService } from 'src/redis/redis.service';
import { ExecutionNotificationBus } from './execution-notification.bus';

@Injectable()
export class ExecutionNotificationSubscriber
  implements OnModuleInit, OnModuleDestroy
{
  private subscriber?: Redis;

  constructor(
    private readonly redis: RedisService,
    private readonly notificationBus: ExecutionNotificationBus,
  ) {}

  async onModuleInit(): Promise<void> {
    this.subscriber = this.redis.createSubscriber();
    this.subscriber.on('message', this.handleMessage);
    this.subscriber.on('error', this.handleError);
    await this.subscriber.subscribe(EXECUTION_NOTIFICATIONS_CHANNEL);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.subscriber) return;

    this.subscriber.off('message', this.handleMessage);
    this.subscriber.off('error', this.handleError);
    await this.subscriber.quit();
  }

  private readonly handleMessage = (channel: string, message: string): void => {
    if (channel !== EXECUTION_NOTIFICATIONS_CHANNEL) return;

    try {
      const notification: unknown = JSON.parse(message);
      if (!isExecutionNotificationV1(notification)) {
        console.warn('[realtime] ignored invalid execution notification');
        return;
      }

      this.notificationBus.emit(notification);
    } catch (error) {
      console.error(
        '[realtime] failed to process execution notification',
        error,
      );
    }
  };

  private readonly handleError = (error: Error): void => {
    console.error('[realtime] execution notification subscriber error', error);
  };
}
