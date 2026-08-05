import { NotFoundException } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import type { Database } from 'src/database/database.types';

describe('ProfilesService', () => {
  function createService(rows: unknown[]) {
    const limit = jest.fn().mockResolvedValue(rows);
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    return {
      service: new ProfilesService({ select } as never as Database),
      select,
    };
  }

  it('returns the profile for the requested user', async () => {
    const profile = { id: 'user_1', displayName: 'Ada' };
    const { service } = createService([profile]);

    await expect(service.getProfileByUserId('user_1')).resolves.toEqual(
      profile,
    );
  });

  it('raises not found when the user has no profile', async () => {
    const { service } = createService([]);

    await expect(service.getProfileByUserId('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
