import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateWorkflowRequest,
  UpdateWorkflowDraftRequest,
} from "@hooklane/contracts";
import {
  archiveWorkflow,
  createWorkflow,
  publishWorkflow,
  updateWorkflowDraft,
  validateWorkflowDraft,
} from "../../../shared/api/workflows-api";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import { workflowQueryKeys } from "../model/workflow-query-keys";

export function useCreateWorkflowMutation(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateWorkflowRequest) =>
      createWorkflow(workspaceId, input),
    onSuccess: async (workflow) => {
      await queryClient.invalidateQueries({
        queryKey: workflowQueryKeys.list(workspaceId),
      });
      notifications.show({
        color: "teal",
        title: "Workflow created",
        message: `${workflow.name} is ready for configuration.`,
      });
    },
    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Could not create workflow",
        message: getApiErrorMessage(error),
      });
    },
  });
}

export function useUpdateWorkflowDraftMutation(
  workspaceId: string,
  workflowId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateWorkflowDraftRequest) =>
      updateWorkflowDraft(workspaceId, workflowId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workflowQueryKeys.draft(workspaceId, workflowId),
      });
      notifications.show({
        color: "teal",
        title: "Draft saved",
        message: "The draft is ready to validate or publish.",
      });
    },
    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Could not save draft",
        message: getApiErrorMessage(error),
      });
    },
  });
}

export function useValidateWorkflowDraftMutation(
  workspaceId: string,
  workflowId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => validateWorkflowDraft(workspaceId, workflowId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: workflowQueryKeys.draft(workspaceId, workflowId),
      });
      notifications.show({
        color: result.isValid ? "teal" : "yellow",
        title: result.isValid ? "Draft is valid" : "Validation found issues",
        message: result.isValid
          ? "You can publish this version."
          : `${result.errors.length} issue(s) need attention.`,
      });
    },
    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Could not validate draft",
        message: getApiErrorMessage(error),
      });
    },
  });
}

export function usePublishWorkflowMutation(
  workspaceId: string,
  workflowId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => publishWorkflow(workspaceId, workflowId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workflowQueryKeys.detail(workspaceId, workflowId),
        }),
        queryClient.invalidateQueries({
          queryKey: workflowQueryKeys.draft(workspaceId, workflowId),
        }),
        queryClient.invalidateQueries({
          queryKey: workflowQueryKeys.versions(workspaceId, workflowId),
        }),
      ]);
      notifications.show({
        color: "teal",
        title: "Workflow published",
        message: "A new editable draft was created for the next version.",
      });
    },
    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Could not publish workflow",
        message: getApiErrorMessage(error),
      });
    },
  });
}

export function useArchiveWorkflowMutation(
  workspaceId: string,
  workflowId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => archiveWorkflow(workspaceId, workflowId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workflowQueryKeys.list(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workflowQueryKeys.detail(workspaceId, workflowId),
        }),
      ]);
      notifications.show({
        color: "gray",
        title: "Workflow archived",
        message: "New executions will no longer be accepted.",
      });
    },
    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Could not archive workflow",
        message: getApiErrorMessage(error),
      });
    },
  });
}
