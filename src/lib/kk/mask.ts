/**
 * Utilitas Nomor Kartu Keluarga (NKK). Hanya fungsi murni: tidak pernah log,
 * tidak menyimpan, dan tidak melempar error yang berisi nomor KK.
 * Nomor KK perlakukan sebagai DATA SENSITIF seperti NIK.
 */

/** Nomor KK Indonesia: tepat 16 digit angka. */
export function isValidKkFormat(input: string): boolean {
  return /^\d{16}$/.test(input);
}

/** Hilangkan spasi/tanda hubung yang sering ikut tersalin dari dokumen, lalu validasi. */
export function normalizeKk(input: string): string | null {
  const cleaned = input.replace(/[\s-]/g, "");
  return isValidKkFormat(cleaned) ? cleaned : null;
}

/** 3573123456781234 -> 3573********1234 */
export function maskKk(kk: string): string {
  if (!isValidKkFormat(kk)) return "****************";
  return `${kk.slice(0, 4)}${"*".repeat(8)}${kk.slice(-4)}`;
}
