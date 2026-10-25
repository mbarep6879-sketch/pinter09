import { createHmac, randomInt } from "node:crypto";
import { pepper } from "@/lib/env";

/** HMAC nomor KK. Nomor KK asli tidak pernah disimpan; hanya hash ini yang masuk database. */
export function hmacKk(kk: string, key = pepper()): string {
  return createHmac("sha256", key).update(`kk:${kk}`).digest("hex");
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O/1/I agar mudah dibaca

export function normalizeInvite(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

/** Kode undangan 8 karakter, ditulis XXXX-XXXX. */
export function generateInviteCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/**
 * Kode dinormalisasi agar salah ketik O/0 dan I/1 tetap cocok. Alfabet kode tidak memuat 0/O/1/I,
 * jadi normalisasi tidak mengurangi keunikan.
 */
export function hmacInvite(code: string, key = pepper()): string {
  return createHmac("sha256", key).update(`invite:${normalizeInvite(code)}`).digest("hex");
}

/** Hash untuk kunci rate limit (IP/KK) agar data mentah tidak masuk database. */
export function hmacKey(scope: string, value: string, key = pepper()): string {
  return createHmac("sha256", key).update(`${scope}:${value}`).digest("hex");
}
