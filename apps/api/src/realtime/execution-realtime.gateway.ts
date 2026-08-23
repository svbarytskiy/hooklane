import type {
  AuthenticatedUser,
  ExecutionNotificationV1,
  WorkspaceSubscriptionRequest,
  WorkspaceSubscriptionResponse,
} from '@hooklane/contracts';
import {
  EXECUTION_NOTIFICATION_EVENT,
  REALTIME_NAMESPACE,
  WORKSPACE_SUBSCRIBE_EVENT,
} from '@hooklane/contracts';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import type { Env } from 'src/config/env.schema';
import { WorkspacesService } from 'src/workspaces/workspaces.service';
import { ExecutionNotificationBus } from './execution-notification.bus';

type SocketData = { user?: AuthenticatedUser };
type AuthenticatedSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

export function workspaceRoom(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}

@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  cors: { origin: true, credentials: false },
})
export class ExecutionRealtimeGateway
  implements OnGatewayInit, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private unsubscribe?: () => void;
  private readonly allowedOrigin: string;
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly authService: AuthService,
    private readonly workspacesService: WorkspacesService,
    private readonly notificationBus: ExecutionNotificationBus,
    config: ConfigService<Env, true>,
  ) {
    this.allowedOrigin = new URL(config.get('WEB_URL', { infer: true })).origin;
  }

  afterInit(server: Server): void {
    this.server = server;
    server.use((socket, next) => {
      void this.authenticateConnection(socket as AuthenticatedSocket)
        .then(() => next())
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'Authentication failed';
          next(new Error(message));
        });
    });
    this.unsubscribe = this.notificationBus.subscribe(this.publishToWorkspace);
  }

  handleConnection(client: AuthenticatedSocket): void {
    this.disconnectWhenTokenExpires(client, this.extractAccessToken(client));
  }

  @SubscribeMessage(WORKSPACE_SUBSCRIBE_EVENT)
  async subscribeToWorkspace(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: unknown,
  ): Promise<WorkspaceSubscriptionResponse> {
    const workspaceId = this.workspaceIdFromPayload(payload);
    const user = client.data.user;

    if (!user || !workspaceId) {
      return { ok: false, error: 'Invalid workspace subscription request' };
    }

    try {
      await this.workspacesService.getMembership(user.id, workspaceId);
    } catch {
      return { ok: false, error: 'Workspace access denied' };
    }

    await client.join(workspaceRoom(workspaceId));
    return { ok: true, workspaceId };
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    for (const timer of this.expiryTimers.values()) clearTimeout(timer);
    this.expiryTimers.clear();
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const timer = this.expiryTimers.get(client.id);
    if (timer) clearTimeout(timer);
    this.expiryTimers.delete(client.id);
  }

  private readonly publishToWorkspace = (
    notification: ExecutionNotificationV1,
  ): void => {
    this.server.volatile
      .to(workspaceRoom(notification.workspaceId))
      .emit(EXECUTION_NOTIFICATION_EVENT, notification);
  };

  private hasAllowedOrigin(client: AuthenticatedSocket): boolean {
    const origin = client.handshake.headers.origin;
    return !origin || origin === this.allowedOrigin;
  }

  private async authenticateConnection(
    client: AuthenticatedSocket,
  ): Promise<void> {
    if (!this.hasAllowedOrigin(client)) {
      throw new Error('Origin is not allowed');
    }

    client.data.user = await this.authService.verifyAccessToken(
      this.extractAccessToken(client),
    );
  }

  private extractAccessToken(client: AuthenticatedSocket): string {
    const auth: unknown = client.handshake.auth;
    if (!auth || typeof auth !== 'object' || Array.isArray(auth)) {
      throw new Error('Missing access token');
    }

    const accessToken = (auth as Record<string, unknown>).accessToken;
    if (typeof accessToken !== 'string' || !accessToken) {
      throw new Error('Missing access token');
    }

    return accessToken;
  }

  private workspaceIdFromPayload(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    const workspaceId = (payload as WorkspaceSubscriptionRequest).workspaceId;
    return typeof workspaceId === 'string' && isUUID(workspaceId, '4')
      ? workspaceId
      : null;
  }

  private disconnectWhenTokenExpires(
    client: AuthenticatedSocket,
    accessToken: string,
  ): void {
    const expiresAt = this.tokenExpiresAt(accessToken);
    if (!expiresAt) return;

    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      client.disconnect(true);
      return;
    }

    const timer = setTimeout(() => {
      client.emit('realtime.error', { error: 'Authentication expired' });
      client.disconnect(true);
    }, delay);
    this.expiryTimers.set(client.id, timer);
  }

  private tokenExpiresAt(accessToken: string): number | null {
    const [, payload] = accessToken.split('.');
    if (!payload) return null;

    try {
      const claims: unknown = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      );
      if (!claims || typeof claims !== 'object' || Array.isArray(claims)) {
        return null;
      }

      const exp = (claims as Record<string, unknown>).exp;
      return typeof exp === 'number' ? exp * 1_000 : null;
    } catch {
      return null;
    }
  }
}
