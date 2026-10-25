import { createBrowserClient } from "@supabase/ssr";

/** Klien browser: hanya anon key. Jangan pernah memakai service_role di sini. */
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
