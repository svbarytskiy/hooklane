import {
  EXECUTION_NOTIFICATION_EVENT,
  isExecutionNotificationV1,
  REALTIME_NAMESPACE,
  type WorkspaceSubscriptionResponse,
  WORKSPACE_SUBSCRIBE_EVENT,
} from "@hooklane/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { env } from "../../../shared/config/env";
import { executionQueryKeys } from "../model/execution-query-keys";

export type RealtimeConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

type Props = {
  workspaceId: string | undefined;
  workflowId: string | undefined;
  accessToken: string | undefined;
  enabled: boolean;
};

const MAX_SEEN_EVENT_IDS = 500;

export function useExecutionRealtime({
  workspaceId,
  workflowId,
  accessToken,
  enabled,
}: Props): RealtimeConnectionStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeConnectionStatus>(
    "disconnected",
  );
  const seenEventIds = useRef(new Set<string>());
  const latestSequenceByExecution = useRef(new Map<string, number>());

  useEffect(() => {
    if (!enabled || !workspaceId || !workflowId || !accessToken) {
      return;
    }

    const socket = io(`${env.apiUrl}${REALTIME_NAMESPACE}`, {
      auth: { accessToken },
      transports: ["websocket"],
    });

    const reconcile = () => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: executionQueryKeys.list(workspaceId, workflowId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["execution-observability", workspaceId, workflowId],
        }),
      ]);
    };

    socket.on("connect", () => {
      setStatus("connected");
      socket.emit(
        WORKSPACE_SUBSCRIBE_EVENT,
        { workspaceId },
        (response: WorkspaceSubscriptionResponse) => {
          if (!response?.ok) {
            setStatus("error");
            return;
          }

          reconcile();
        },
      );
    });

    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("error"));
    socket.on("realtime.error", () => setStatus("error"));
    socket.on(EXECUTION_NOTIFICATION_EVENT, (value: unknown) => {
      if (!isExecutionNotificationV1(value)) return;
      if (
        value.workspaceId !== workspaceId ||
        value.workflowId !== workflowId ||
        seenEventIds.current.has(value.eventId)
      ) {
        return;
      }

      const latestSequence = latestSequenceByExecution.current.get(
        value.executionId,
      );
      if (latestSequence !== undefined && value.sequence <= latestSequence) {
        return;
      }

      seenEventIds.current.add(value.eventId);
      if (seenEventIds.current.size > MAX_SEEN_EVENT_IDS) {
        const oldest = seenEventIds.current.values().next().value;
        if (oldest) seenEventIds.current.delete(oldest);
      }
      latestSequenceByExecution.current.set(value.executionId, value.sequence);

      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: executionQueryKeys.list(workspaceId, workflowId),
        }),
        queryClient.invalidateQueries({
          queryKey: executionQueryKeys.detail(
            workspaceId,
            workflowId,
            value.executionId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: ["execution-observability", workspaceId, workflowId],
        }),
      ]);
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, enabled, queryClient, workflowId, workspaceId]);

  return enabled && workspaceId && workflowId && accessToken
    ? status
    : "disconnected";
}
