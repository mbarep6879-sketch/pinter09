import { humanizeError } from "@/lib/errors/messages";

export type Ok<T> = { ok: true; data: T };
export type Fail = { ok: false; code: string; message: string };
export type Result<T> = Ok<T> | Fail;

const CODE = /\b([A-Z][A-Z_]{3,})\b/;

/** Mengambil kode error (mis. ALREADY_VOTED) dari pesan Postgres. Pesan mentah tidak diteruskan ke pengguna. */
export function failFrom(error: { message?: string } | null | undefined): Fail {
  const raw = error?.message ?? "";
  return { ok: false, code: raw.match(CODE)?.[1] ?? "UNKNOWN", message: humanizeError(raw) };
}

export const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
