import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export const supabaseClient = createClient(env.supabaseUrl, env.supabaseAnonKey);
