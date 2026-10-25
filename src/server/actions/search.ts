"use server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/roles";
import { hmacKk } from "@/lib/kk/hash";
import { normalizeKk } from "@/lib/kk/mask";

export type VoterRow = { id: string; nama: string; jenis_kelamin: "L" | "P"; hubungan: string; alamat: string; rt: string; kk_masked: string; has_voting_right: boolean; sudah_memilih: boolean; channel: string | null };
export type KkSearchState = { error?: string; rows?: VoterRow[] };

/** Pencarian per Nomor KK lewat POST (server action): nomor KK tidak pernah masuk URL, log akses, atau riwayat browser. */
export async function searchKkAction(_: KkSearchState, fd: FormData): Promise<KkSearchState> {
  const staff = await getStaff();
  if (!staff || !canAccess(staff.role, "pemilih")) return { error: "Anda tidak memiliki kewenangan untuk melakukan tindakan ini." };
  const kk = normalizeKk(String(fd.get("kk") ?? ""));
  if (!kk) return { error: "Nomor KK harus 16 digit angka." };
  const sb = await createServerSupabase();
  const { data, error } = await sb.rpc("list_voters", { p_kk_hash: hmacKk(kk), p_limit: 20, p_offset: 0 });
  if (error) return { error: "Pencarian belum dapat dilakukan. Coba lagi." };
  return { rows: (data ?? []) as VoterRow[] };
}
