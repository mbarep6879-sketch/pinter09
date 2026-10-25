import { createAnonClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import type { ElectionStatus } from "@/lib/constants";

export type PublicElection = { id: string; type: string; nama: string; status: ElectionStatus; method: string | null; rt: string | null; mulai: string | null; selesai: string | null; lokasi: string | null };

/** Hanya data yang diizinkan RLS untuk publik (pemilihan non-draft dan jadwalnya). Tanpa data pemilih. */
/** null = gagal memuat (jangan disamakan dengan "belum ada jadwal"). */
export async function loadPublicElections(): Promise<PublicElection[] | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = createAnonClient();
  const [{ data: es, error: e1 }, { data: ss, error: e2 }] = await Promise.all([
    sb.from("elections").select("id, type, nama, status, method, neighborhoods(code)"),
    sb.from("election_schedules").select("election_id, mulai, selesai, lokasi"),
  ]);
  if (e1 || e2 || !es || !ss) return null;
  const sch = new Map((ss ?? []).map((s) => [s.election_id as string, s]));
  type R = { id: string; type: string; nama: string; status: ElectionStatus; method: string | null; neighborhoods: { code: string } | { code: string }[] | null };
  return ((es ?? []) as unknown as R[]).map((e) => {
    const s = sch.get(e.id);
    return { id: e.id, type: e.type, nama: e.nama, status: e.status, method: e.method, rt: (Array.isArray(e.neighborhoods) ? e.neighborhoods[0] : e.neighborhoods)?.code ?? null,
      mulai: s?.mulai ?? null, selesai: s?.selesai ?? null, lokasi: s?.lokasi ?? null };
  }).sort((a, b) => (a.rt ?? "ZZ").localeCompare(b.rt ?? "ZZ"));
}
