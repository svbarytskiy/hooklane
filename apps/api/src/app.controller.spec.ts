import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { SUPABASE_ADMIN_CLIENT } from './supabase/supabase.tokens';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: SUPABASE_ADMIN_CLIENT,
          useValue: {
            from: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ error: null }),
              }),
            }),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('returns a healthy application status', () => {
    expect(appController.getHealth()).toEqual({ status: 'ok' });
  });

  it('returns a healthy Supabase status when the query succeeds', async () => {
    await expect(appController.getSupabaseHealth()).resolves.toEqual({
      status: 'ok',
      error: null,
    });
  });
});
