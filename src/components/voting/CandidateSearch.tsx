"use client";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { Candidate } from "@/server/services/voting";
import { Input } from "@/components/ui/input";
import { CandidateCard } from "./CandidateCard";

/**
 * Pencarian bakal calon RW. Mengetik hanya menyaring daftar; pilihan SAH hanya terjadi saat pemilih
 * menekan salah satu kartu (berbasis id calon), jadi nama yang mirip/sama tidak pernah tertukar.
 */
export function CandidateSearch({ candidates, max, selected, onChange }: { candidates: Candidate[]; max: number; selected: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? candidates.filter((c) => `${c.nama} ${c.rt} ${c.alamat}`.toLowerCase().includes(n)) : candidates;
  }, [q, candidates]);
  const chosen = candidates.filter((c) => selected.includes(c.id));
  const full = selected.length >= max;
  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (max === 1) onChange([id]);
    else if (!full) onChange([...selected, id]);
  }
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">{max === 1 ? "Ketik nama, lalu tekan kartu calon yang benar." : `Ketik nama, lalu tekan kartu calon yang benar (maksimal ${max}).`}</p>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-3.5 size-5 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, RT, atau alamat" className="pl-10" aria-label="Cari bakal calon" autoComplete="off" />
      </div>
      {chosen.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="Pilihan Anda">
          {chosen.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-full bg-primary py-1.5 pl-3 pr-2 text-sm font-semibold text-primary-foreground">
              {c.nama} ({c.rt})
              <button type="button" onClick={() => toggle(c.id)} aria-label={`Hapus pilihan ${c.nama}`}><X className="size-4" aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
        {shown.length === 0 && <p className="py-6 text-center text-muted-foreground">Tidak ada calon yang cocok.</p>}
        {shown.map((c) => <CandidateCard key={c.id} c={c} selected={selected.includes(c.id)} onToggle={() => toggle(c.id)} disabled={max > 1 && full} />)}
      </div>
    </div>
  );
}
