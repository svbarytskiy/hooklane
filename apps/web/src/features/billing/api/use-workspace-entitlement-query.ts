import { useQuery } from "@tanstack/react-query";
import { getWorkspaceEntitlement } from "../../../shared/api/entitlements-api";

export function useWorkspaceEntitlementQuery(
  workspaceId: string | null,
  isAuthenticated: boolean,
) {
  return useQuery({
    queryKey: ["workspace-entitlement", workspaceId],
    queryFn: () => getWorkspaceEntitlement(workspaceId as string),
    enabled: Boolean(workspaceId) && isAuthenticated,
  });
}
