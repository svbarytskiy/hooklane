import type { ExecutionNotificationV1 } from '@hooklane/contracts';
import { Injectable } from '@nestjs/common';

type ExecutionNotificationListener = (
  notification: ExecutionNotificationV1,
) => void;

@Injectable()
export class ExecutionNotificationBus {
  private readonly listeners = new Set<ExecutionNotificationListener>();

  subscribe(listener: ExecutionNotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(notification: ExecutionNotificationV1): void {
    for (const listener of this.listeners) {
      try {
        listener(notification);
      } catch (error) {
        console.error('[realtime] notification listener failed', error);
      }
    }
  }
}
