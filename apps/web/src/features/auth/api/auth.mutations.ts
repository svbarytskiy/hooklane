import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiErrorMessage } from '../../../shared/api/api-error';
import { supabaseClient } from '../../../shared/lib/supabase-client';
import { authQueryKeys } from '../model/auth-query-keys';

export type AuthCredentials = {
  email: string;
  password: string;
};

async function signInWithPassword(credentials: AuthCredentials) {
  const { error } = await supabaseClient.auth.signInWithPassword(credentials);

  if (error) {
    throw error;
  }
}

async function signUpWithPassword(credentials: AuthCredentials) {
  const { error } = await supabaseClient.auth.signUp(credentials);

  if (error) {
    throw error;
  }
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    throw error;
  }
}

export function useSignInMutation() {
  return useMutation({
    mutationFn: signInWithPassword,
    onSuccess: () => {
      notifications.show({
        title: 'Signed in',
        message: 'Supabase session created.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Sign in failed',
        message: getApiErrorMessage(error),
      });
    },
  });
}

export function useSignUpMutation() {
  return useMutation({
    mutationFn: signUpWithPassword,
    onSuccess: () => {
      notifications.show({
        title: 'Signed up',
        message: 'Check local Inbucket if email confirmation is enabled.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Sign up failed',
        message: getApiErrorMessage(error),
      });
    },
  });
}

export function useSignOutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      void queryClient.removeQueries({ queryKey: authQueryKeys.all });

      notifications.show({
        title: 'Signed out',
        message: 'Local Supabase session cleared.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Sign out failed',
        message: getApiErrorMessage(error),
      });
    },
  });
}
