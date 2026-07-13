import {
  Alert,
  Button,
  Code,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { getApiErrorMessage } from '../../../shared/api/api-error';
import {
  useSignInMutation,
  useSignOutMutation,
  useSignUpMutation,
} from '../api/auth.mutations';
import { useCurrentUserQuery } from '../api/use-current-user-query';
import { useAuthSession } from '../model/use-auth-session';

export function AuthPage() {
  const { session, accessToken, user } = useAuthSession();
  const currentUserQuery = useCurrentUserQuery(accessToken);
  const signInMutation = useSignInMutation();
  const signUpMutation = useSignUpMutation();
  const signOutMutation = useSignOutMutation();

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Enter a valid email'),
      password: (value) => (value.length >= 6 ? null : 'Use at least 6 characters'),
    },
  });

  const handleSignIn = form.onSubmit((values) => {
    signInMutation.mutate(values);
  });

  const handleSignUp = () => {
    const validation = form.validate();

    if (validation.hasErrors) return;

    signUpMutation.mutate(form.values);
  };

  const handleSignOut = () => {
    signOutMutation.mutate();
  };

  const isAuthActionPending =
    signInMutation.isPending || signUpMutation.isPending || signOutMutation.isPending;

  return (
    <Stack maw={560} gap="lg">
      <div>
        <Title order={2}>Auth</Title>
        <Text c="dimmed" mt={4}>
          Supabase browser auth synced with Nest /auth/me through React Query.
        </Text>
      </div>

      <form onSubmit={handleSignIn}>
        <Stack>
          <TextInput
            label="Email"
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            disabled={isAuthActionPending}
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            placeholder="At least 6 characters"
            autoComplete="current-password"
            disabled={isAuthActionPending}
            {...form.getInputProps('password')}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              type="button"
              onClick={handleSignUp}
              loading={signUpMutation.isPending}
              disabled={signInMutation.isPending || signOutMutation.isPending}
            >
              Sign up
            </Button>
            <Button
              type="submit"
              loading={signInMutation.isPending}
              disabled={signUpMutation.isPending || signOutMutation.isPending}
            >
              Sign in
            </Button>
            <Button
              variant="light"
              color="red"
              type="button"
              onClick={handleSignOut}
              disabled={!session || signInMutation.isPending || signUpMutation.isPending}
              loading={signOutMutation.isPending}
            >
              Sign out
            </Button>
          </Group>
        </Stack>
      </form>

      <Alert color={session ? 'green' : 'gray'} title="Supabase session">
        {session ? (
          <Stack gap={4}>
            <Text size="sm">Signed in as {user?.email ?? user?.id}</Text>
            <Text size="sm">
              Access token: <Code>{session.access_token.slice(0, 16)}...</Code>
            </Text>
          </Stack>
        ) : (
          <Text size="sm">No active session.</Text>
        )}
      </Alert>

      <Alert
        color={currentUserQuery.isError ? 'red' : currentUserQuery.data ? 'green' : 'gray'}
        title="Backend /auth/me"
      >
        {currentUserQuery.isLoading && <Text size="sm">Checking backend session...</Text>}
        {currentUserQuery.isError && (
          <Text size="sm">{getApiErrorMessage(currentUserQuery.error)}</Text>
        )}
        {currentUserQuery.data && (
          <Code block>{JSON.stringify(currentUserQuery.data, null, 2)}</Code>
        )}
        {!accessToken && <Text size="sm">Sign in to call backend.</Text>}
      </Alert>
    </Stack>
  );
}
