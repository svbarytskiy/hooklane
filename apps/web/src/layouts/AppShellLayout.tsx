import {
  AppShell,
  Badge,
  Box,
  Group,
  NavLink as MantineNavLink,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconCreditCard,
  IconHome,
  IconLogin2,
  IconShieldDollar,
  IconSettingsAutomation,
} from "@tabler/icons-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuthSession } from "../features/auth/model/use-auth-session";
import { useBillingRealtimeSync } from "../features/billing/realtime/use-billing-realtime-sync";
import { useMyProfileQuery } from "../features/profiles/api/use-my-profile-query";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: IconHome },
  { label: "Auth", to: "/auth", icon: IconLogin2 },
  { label: "Billing", to: "/billing", icon: IconCreditCard },
];

export function AppShellLayout() {
  const location = useLocation();
  const { accessToken, user } = useAuthSession();
  useBillingRealtimeSync(user?.id);
  const profileQuery = useMyProfileQuery(Boolean(accessToken));
  const visibleNavItems =
    profileQuery.data?.role === "admin"
      ? [
          ...navItems,
          {
            label: "Admin billing",
            to: "/admin/billing",
            icon: IconShieldDollar,
          },
        ]
      : navItems;

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 260, breakpoint: "sm" }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <ThemeIcon variant="light" size="lg">
              <IconSettingsAutomation size={20} />
            </ThemeIcon>
            <Box>
              <Title order={4} lh={1.1}>
                Billing Lab
              </Title>
              <Text size="xs" c="dimmed">
                Stripe + Supabase integration workspace
              </Text>
            </Box>
          </Group>
          <Badge variant="light" color="gray">
            Local dev
          </Badge>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap={4}>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <MantineNavLink
                key={item.to}
                component={Link}
                to={item.to}
                label={item.label}
                active={location.pathname === item.to}
                leftSection={<Icon size={18} />}
              />
            );
          })}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
