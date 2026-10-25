import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Klien service_role: HANYA untuk kode server (server action / route handler) setelah otorisasi.
 * SUPABASE_SERVICE_ROLE_KEY tanpa awalan NEXT_PUBLIC_ sehingga tidak ikut ke bundel browser.
 */
export function createAdminClient(opts?: { url?: string; key?: string; fetch?: typeof fetch }): SupabaseClient {
  const url = opts?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = opts?.key ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi Supabase server belum lengkap");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: opts?.fetch ? { fetch: opts.fetch } : undefined,
  });
}

/** Klien anon tanpa sesi: untuk halaman publik (tunduk pada RLS). */
export function createAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Konfigurasi Supabase belum lengkap");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
