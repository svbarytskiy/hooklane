import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabaseClient } from "../../../shared/lib/supabase-client";
import { billingQueryKeys } from "../model/billing-query-keys";

export function useBillingRealtimeSync(userId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const invalidatePaymentQueries = () => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: billingQueryKeys.payments(),
        }),
        queryClient.invalidateQueries({
          queryKey: billingQueryKeys.credits(),
        }),
        queryClient.invalidateQueries({
          queryKey: billingQueryKeys.state(),
        }),
      ]);
    };

    const invalidateSubscriptionQueries = () => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: billingQueryKeys.subscription(),
        }),
        queryClient.invalidateQueries({
          queryKey: billingQueryKeys.state(),
        }),
        queryClient.invalidateQueries({
          queryKey: billingQueryKeys.invoices(),
        }),
        queryClient.invalidateQueries({
          queryKey: billingQueryKeys.upcomingInvoice(),
        }),
      ]);
    };

    const channel = supabaseClient
      .channel(`billing:${userId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "payments",
          filter: `user_id=eq.${userId}`,
        },
        invalidatePaymentQueries,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payments",
          filter: `user_id=eq.${userId}`,
        },
        invalidatePaymentQueries,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        invalidateSubscriptionQueries,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        invalidateSubscriptionQueries,
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;

        void queryClient.invalidateQueries({
          queryKey: billingQueryKeys.all,
        });
      });

    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [queryClient, userId]);
}
