/** Akses environment variable di server. Kegagalan konfigurasi harus keras, bukan diam-diam. */
export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Konfigurasi ${name} belum diisi`);
  return v;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function pepper(): string {
  const p = required("KK_HMAC_PEPPER");
  if (p.length < 32) throw new Error("KK_HMAC_PEPPER minimal 32 karakter");
  return p;
}
