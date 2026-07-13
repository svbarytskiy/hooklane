import axios from 'axios';
import { env } from '../config/env';
import { supabaseClient } from '../lib/supabase-client';

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (session?.access_token) {
    config.headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  return config;
});
