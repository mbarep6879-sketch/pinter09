import type { Candidate } from "@/server/services/voting";
import { CandidateCard } from "./CandidateCard";

/** Pilihan calon RT: kartu besar, batas pilihan mengikuti max_choices dari panitia. */
export function CandidateSelector({ candidates, max, selected, onChange }: { candidates: Candidate[]; max: number; selected: string[]; onChange: (ids: string[]) => void }) {
  const full = selected.length >= max;
  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (max === 1) onChange([id]);
    else if (!full) onChange([...selected, id]);
  }
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">{max === 1 ? "Pilih 1 calon." : `Pilih sampai ${max} calon (terpilih ${selected.length}).`}</p>
      <div className="space-y-3">
        {candidates.map((c) => <CandidateCard key={c.id} c={c} selected={selected.includes(c.id)} onToggle={() => toggle(c.id)} disabled={max > 1 && full} />)}
      </div>
    </div>
  );
}
