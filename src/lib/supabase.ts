import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False until .env.local (or the GitHub repo variables) provide the project URL and anon key. */
export const isConfigured = Boolean(url && anonKey && !url.includes('YOUR-PROJECT-REF'));

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: true, detectSessionInUrl: true } })
  : null;
