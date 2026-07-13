import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiErrorMessage } from '../../../shared/api/api-error';
import { createStripeCustomer } from '../../../shared/api/billing-api';
import { billingQueryKeys } from '../model/billing-query-keys';

export function useCreateStripeCustomerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createStripeCustomer,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: billingQueryKeys.state(),
      });

      notifications.show({
        title: 'Stripe customer ready',
        message: 'The Stripe customer is linked to your account.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Customer creation failed',
        message: getApiErrorMessage(error),
      });
    },
  });
}
