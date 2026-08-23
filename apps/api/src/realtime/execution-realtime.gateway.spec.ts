jest.mock('@hooklane/contracts', () => ({
  EXECUTION_NOTIFICATION_EVENT: 'execution.notification',
  REALTIME_NAMESPACE: '/realtime',
  WORKSPACE_SUBSCRIBE_EVENT: 'workspace.subscribe',
}));

import {
  ExecutionRealtimeGateway,
  workspaceRoom,
} from './execution-realtime.gateway';

type SocketMiddleware = (
  client: unknown,
  next: (error?: Error) => void,
) => void;

describe('ExecutionRealtimeGateway', () => {
  const user = { id: 'user-id', email: 'user@example.com' };

  function createGateway() {
    let listener: ((notification: unknown) => void) | undefined;
    const authService = {
      verifyAccessToken: jest.fn().mockResolvedValue(user),
    };
    const workspacesService = {
      getMembership: jest.fn().mockResolvedValue({}),
    };
    const notificationBus = {
      subscribe: jest.fn((nextListener: (notification: unknown) => void) => {
        listener = nextListener;
        return jest.fn();
      }),
    };
    const config = {
      get: jest.fn().mockReturnValue('https://web.example.com'),
    };
    const gateway = new ExecutionRealtimeGateway(
      authService as never,
      workspacesService as never,
      notificationBus as never,
      config as never,
    );

    return {
      gateway,
      authService,
      workspacesService,
      getListener: () => listener,
    };
  }

  it('authenticates a browser socket from its Supabase access token', async () => {
    const { gateway, authService } = createGateway();
    let middleware: SocketMiddleware | undefined;
    gateway.afterInit({
      use: (handler) => {
        middleware = handler as typeof middleware;
      },
    } as never);
    const client = {
      handshake: {
        headers: { origin: 'https://web.example.com' },
        auth: { accessToken: 'access-token' },
      },
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    await new Promise<void>((resolve, reject) => {
      middleware?.(client, (error) => (error ? reject(error) : resolve()));
    });
    gateway.handleConnection(client as never);

    expect(authService.verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(client.data).toEqual({ user });
  });

  it('joins only a workspace the authenticated user belongs to', async () => {
    const { gateway, workspacesService } = createGateway();
    const client = {
      data: { user },
      join: jest.fn().mockResolvedValue(undefined),
    };
    const workspaceId = '11111111-1111-4111-8111-111111111111';

    await expect(
      gateway.subscribeToWorkspace(client as never, { workspaceId }),
    ).resolves.toEqual({ ok: true, workspaceId });

    expect(workspacesService.getMembership).toHaveBeenCalledWith(
      user.id,
      workspaceId,
    );
    expect(client.join).toHaveBeenCalledWith(workspaceRoom(workspaceId));
  });

  it('forwards a Redis-delivered notification only to its workspace room', () => {
    const { gateway, getListener } = createGateway();
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const server = { use: jest.fn(), volatile: { to } };
    gateway.afterInit(server as never);
    const listener = getListener();

    listener?.({
      workspaceId: 'workspace-id',
      workflowId: 'workflow-id',
      executionId: 'execution-id',
    });

    expect(to).toHaveBeenCalledWith(workspaceRoom('workspace-id'));
    expect(emit).toHaveBeenCalledWith('execution.notification', {
      workspaceId: 'workspace-id',
      workflowId: 'workflow-id',
      executionId: 'execution-id',
    });
  });
});
