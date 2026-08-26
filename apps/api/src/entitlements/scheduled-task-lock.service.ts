import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';

@Injectable()
export class ScheduledTaskLockService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async tryAcquire(taskName: string, leaseSeconds: number): Promise<boolean> {
    const rows = await this.db.execute(sql`
      select public.try_acquire_scheduled_task_lock(${taskName}, ${leaseSeconds}) as acquired
    `);
    return (rows[0] as { acquired?: boolean } | undefined)?.acquired === true;
  }
}
