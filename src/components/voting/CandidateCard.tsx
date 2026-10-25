import { Check } from "lucide-react";
import type { Candidate } from "@/server/services/voting";
import { cn } from "@/lib/utils";

const JK = { L: "Laki-laki", P: "Perempuan" } as const;

/**
 * Identitas calon tidak hanya nama: nomor, jenis kelamin, RT, dan alamat ikut ditampilkan sehingga
 * dua calon bernama sama tetap dapat dibedakan. Yang dikirim ke server adalah id calon (UUID).
 */
export function CandidateCard({ c, selected, onToggle, disabled }: { c: Candidate; selected: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onToggle} disabled={disabled && !selected} aria-pressed={selected}
      className={cn("flex w-full items-start gap-4 rounded-lg border bg-card p-4 text-left transition-colors disabled:opacity-40",
        selected ? "border-primary bg-ink-soft ring-2 ring-primary" : "hover:border-primary")}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{String(c.nomor_urut).padStart(2, "0")}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold leading-tight">{c.nama}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{JK[c.jenis_kelamin]} · {c.rt}</span>
        {c.alamat && <span className="block text-sm text-muted-foreground">{c.alamat}</span>}
      </span>
      {selected && <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary"><Check className="size-5" aria-hidden /> Dipilih</span>}
    </button>
  );
}
