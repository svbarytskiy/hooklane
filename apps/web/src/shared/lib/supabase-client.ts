import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import type { Database } from "../types/supabase-database";

export const supabaseClient = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
);
