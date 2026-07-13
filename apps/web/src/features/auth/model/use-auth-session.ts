import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabaseClient } from '../../../shared/lib/supabase-client';

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void supabaseClient.auth.getSession().then(({ data }) => {
      if (!isMounted) return;

      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    isLoading,
    accessToken: session?.access_token,
    user: session?.user ?? null,
  };
}
