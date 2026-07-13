import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShellLayout } from '../layouts/AppShellLayout';
import { AuthPage } from '../pages/auth/AuthPage';
import { BillingOverviewPage } from '../pages/billing/BillingOverviewPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShellLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'auth', element: <AuthPage /> },
      { path: 'billing', element: <BillingOverviewPage /> },
    ],
  },
]);
