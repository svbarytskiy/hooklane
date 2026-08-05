import { ProfilesController } from './profiles.controller';
import type { AuthenticatedUser } from 'src/auth/auth.types';
import type { ProfilesService } from './profiles.service';

describe('ProfilesController', () => {
  it('delegates the current user id to the profiles service', async () => {
    const profile = { id: 'user_1', displayName: 'Ada' };
    const getProfileByUserId = jest.fn().mockResolvedValue(profile);
    const profilesService = {
      getProfileByUserId,
    } as unknown as ProfilesService;
    const controller = new ProfilesController(profilesService);
    const user: AuthenticatedUser = { id: 'user_1', email: 'user@example.com' };

    await expect(controller.getMyProfile(user)).resolves.toEqual(profile);
    expect(getProfileByUserId).toHaveBeenCalledWith('user_1');
  });
});
