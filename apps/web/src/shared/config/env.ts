const envRecord = import.meta.env;

export const env = {
  apiUrl: requireEnv('VITE_API_URL'),
  supabaseUrl: requireEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('VITE_SUPABASE_ANON_KEY'),
};

function requireEnv(key: string): string {
  const value = envRecord[key];

  if (!value) {
    throw new Error(`Missing frontend environment variable: ${key}`);
  }

  return value;
}
