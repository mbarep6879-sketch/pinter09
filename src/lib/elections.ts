import type { SupabaseClient } from "@supabase/supabase-js";
import type { ElectionStatus } from "@/lib/constants";

export type Election = {
  id: string; type: "RT" | "RW_NOMINATION" | "RW_FINAL"; nama: string; status: ElectionStatus; method: "VOTING" | "MUSYAWARAH" | null;
  max_choices: number | null; config: { musyawarah?: { peserta: number; hasil: string; pengurus: { nama: string; jabatan: string }[]; catatan: string; tanggal: string } };
  neighborhood_id: string | null; rt: string | null; label: string;
};

export async function loadElections(sb: SupabaseClient): Promise<Election[]> {
  const { data } = await sb.from("elections").select("id, type, nama, status, method, max_choices, config, neighborhood_id, neighborhoods(code)");
  type Raw = Omit<Election, "rt" | "label"> & { neighborhoods: { code: string } | { code: string }[] | null };
  const list = ((data ?? []) as unknown as Raw[]).map((e) => {
    const rt = (Array.isArray(e.neighborhoods) ? e.neighborhoods[0] : e.neighborhoods)?.code ?? null;
    const { neighborhoods: _n, ...rest } = e; void _n;
    return { ...rest, rt, label: rt ?? (e.type === "RW_NOMINATION" ? "Penjaringan RW 09" : "Pemilihan RW 09") } as Election;
  });
  return list.sort((a, b) => (a.rt ?? "ZZ" + a.type).localeCompare(b.rt ?? "ZZ" + b.type));
}
export const pickElection = (list: Election[], id?: string) => list.find((e) => e.id === id) ?? list[0];
