import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { AdminBillingPage } from "../pages/admin/AdminBillingPage";
import { AuthPage } from "../pages/auth/AuthPage";
import { BillingCheckoutCancelPage } from "../pages/billing/BillingCheckoutCancelPage";
import { BillingCheckoutSuccessPage } from "../pages/billing/BillingCheckoutSuccessPage";
import { BillingOverviewPage } from "../pages/billing/BillingOverviewPage";
import { BillingSubscriptionCancelPage } from "../pages/billing/BillingSubscriptionCancelPage";
import { BillingSubscriptionSuccessPage } from "../pages/billing/BillingSubscriptionSuccessPage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { WorkspacesPage } from "../pages/workspaces/WorkspacesPage";
import { WorkflowEditorPage } from "../pages/workflows/WorkflowEditorPage";
import { WorkflowsPage } from "../pages/workflows/WorkflowsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShellLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "workspaces", element: <WorkspacesPage /> },
      {
        path: "workspaces/:workspaceId/workflows",
        element: <WorkflowsPage />,
      },
      {
        path: "workspaces/:workspaceId/workflows/:workflowId",
        element: <WorkflowEditorPage />,
      },
      { path: "auth", element: <AuthPage /> },
      { path: "billing", element: <BillingOverviewPage /> },
      { path: "admin/billing", element: <AdminBillingPage /> },
      { path: "billing/success", element: <BillingCheckoutSuccessPage /> },
      { path: "billing/cancel", element: <BillingCheckoutCancelPage /> },
      {
        path: "billing/subscription/success",
        element: <BillingSubscriptionSuccessPage />,
      },
      {
        path: "billing/subscription/cancel",
        element: <BillingSubscriptionCancelPage />,
      },
    ],
  },
]);
