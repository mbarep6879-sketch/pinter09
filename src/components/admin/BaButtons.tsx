"use client";
import { useFormStatus } from "react-dom";

export function BaButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      <button name="finalize" value="0" disabled={pending} className="inline-flex h-11 items-center rounded-md border bg-card px-5 text-sm font-semibold hover:bg-muted disabled:opacity-50">Simpan draf</button>
      <button name="finalize" value="1" disabled={pending} onClick={(e) => { if (!window.confirm("Finalisasi Berita Acara? Setelah final, dokumen terkunci dan tidak dapat diubah.")) e.preventDefault(); }}
        className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Finalisasi &amp; kunci</button>
    </div>
  );
}
