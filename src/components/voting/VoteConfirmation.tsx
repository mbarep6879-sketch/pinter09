import { Button } from "@/components/ui/button";
import type { BallotOptions } from "@/server/services/voting";

function names(section: BallotOptions["rt"], ids: string[]) {
  return (section?.candidates ?? []).filter((c) => ids.includes(c.id));
}

export function VoteConfirmation({ options, rtIds, rwIds, busy, disabled, onBack, onConfirm }: { options: BallotOptions; rtIds: string[]; rwIds: string[]; busy: boolean; disabled: boolean; onBack: () => void; onConfirm: () => void }) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-extrabold">Konfirmasi pilihan</h2>
      <section className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Calon Pengurus RT</h3>
        <ul className="mt-1 space-y-1">{names(options.rt, rtIds).map((c) => <li key={c.id} className="text-lg font-bold">{String(c.nomor_urut).padStart(2, "0")}. {c.nama}</li>)}</ul>
      </section>
      {options.rw && (
        <section className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Bakal Calon Pengurus RW 09</h3>
          <ul className="mt-1 space-y-1">{names(options.rw, rwIds).map((c) => <li key={c.id} className="text-lg font-bold">{c.nama} <span className="text-sm font-normal text-muted-foreground">({c.rt})</span></li>)}</ul>
        </section>
      )}
      <p className="rounded-md bg-warning-soft p-3 text-sm font-semibold text-warning">Setelah dikonfirmasi, pilihan tidak dapat diubah.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="outline" size="lg" onClick={onBack} disabled={busy}>Kembali</Button>
        <Button size="lg" onClick={onConfirm} disabled={busy || disabled}>{busy ? "Mengirim..." : "Konfirmasi & kirim suara"}</Button>
      </div>
    </div>
  );
}
