import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { AuthPage } from "../pages/auth/AuthPage";
import { BillingCheckoutCancelPage } from "../pages/billing/BillingCheckoutCancelPage";
import { BillingOverviewPage } from "../pages/billing/BillingOverviewPage";
import { BillingCheckoutSuccessPage } from "../pages/billing/BillingCheckoutSuccessPage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShellLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "auth", element: <AuthPage /> },
      { path: "billing", element: <BillingOverviewPage /> },
      { path: "billing/success", element: <BillingCheckoutSuccessPage /> },
      { path: "billing/cancel", element: <BillingCheckoutCancelPage /> },
    ],
  },
]);
