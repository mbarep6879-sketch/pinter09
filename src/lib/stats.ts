import type { ElectionStatus } from "@/lib/constants";

export type RtStat = {
  rt: string; neighborhood_id: string; election_id: string; status: ElectionStatus; method: "VOTING" | "MUSYAWARAH" | null;
  kk: number; berhak_l: number; berhak_p: number; sudah_online: number; sudah_manual: number;
};
export type Stats = { rt: RtStat[]; rw: { election_id: string; status: ElectionStatus; sudah: number } | null };

export const hak = (r: RtStat) => r.berhak_l + r.berhak_p;
export const sudah = (r: RtStat) => r.sudah_online + r.sudah_manual;

export function totals(rows: RtStat[]) {
  const t = rows.reduce((a, r) => ({ kk: a.kk + r.kk, l: a.l + r.berhak_l, p: a.p + r.berhak_p, on: a.on + r.sudah_online, man: a.man + r.sudah_manual }), { kk: 0, l: 0, p: 0, on: 0, man: 0 });
  const total = t.l + t.p, voted = t.on + t.man;
  return { ...t, total, voted, belum: Math.max(total - voted, 0) };
}

export type StepState = "done" | "active" | "todo";
export function stepState(s: ElectionStatus): StepState {
  if (s === "SELESAI" || s === "DITETAPKAN") return "done";
  if (s === "PEMILIHAN_BERLANGSUNG" || s === "PERHITUNGAN") return "active";
  return "todo";
}

/** Perolehan sama pada urutan mana pun ditandai; sistem TIDAK memilih pemenang otomatis. Suara 0 tidak dianggap seri. */
export function hasTie(rows: { total_votes: number }[]): boolean {
  const seen = new Set<number>();
  for (const r of rows) { const v = Number(r.total_votes); if (v > 0 && seen.has(v)) return true; seen.add(v); }
  return false;
}
