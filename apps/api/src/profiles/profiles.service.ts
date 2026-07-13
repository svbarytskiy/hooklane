import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { profiles } from 'src/database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
  ) {}

  async getProfileByUserId(userId: string) {
    const [profile] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }
}
