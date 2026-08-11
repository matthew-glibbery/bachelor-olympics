/**
 * Browser Supabase client (Phase 1).
 *
 * Reads the public URL + anon key from env (see .env.example / .env.local).
 * Components should NOT import this directly — they read from the zustand store
 * (src/store), which the data-access layer (src/lib/data) keeps in sync via
 * queries + Realtime. This keeps the UI backend-agnostic and testable.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

/** Lazily create (and reuse) the browser Supabase client. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy .env.example to .env.local and fill them in.",
    );
  }

  browserClient = createClient(url, anonKey);
  return browserClient;
}
