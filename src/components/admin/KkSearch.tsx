"use client";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { searchKkAction, type KkSearchState } from "@/server/actions/search";

export function KkSearch() {
  const [s, action] = useActionState<KkSearchState, FormData>(searchKkAction, {});
  return (
    <div className="rounded-lg border bg-card p-4">
      <form action={action} className="flex flex-wrap items-end gap-3" autoComplete="off">
        <label className="min-w-64 flex-1 space-y-1.5"><span className="text-sm font-semibold">Cari per Nomor KK</span>
          <Input name="kk" inputMode="numeric" autoComplete="off" placeholder="16 digit nomor KK" /></label>
        <SubmitButton pendingText="Mencari...">Cari</SubmitButton>
      </form>
      <p className="mt-1 text-xs text-muted-foreground">Nomor KK tidak ditampilkan kembali dan tidak masuk alamat halaman.</p>
      {s.error && <Alert kind="error" className="mt-3">{s.error}</Alert>}
      {s.rows && (s.rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Tidak ada anggota ditemukan untuk KK tersebut.</p> : (
        <ul className="mt-3 divide-y text-sm">
          {s.rows.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><b>{r.nama}</b> · {r.hubungan} · {r.rt} · {r.kk_masked}</span><span>{r.has_voting_right ? (r.sudah_memilih ? `Sudah memilih (${r.channel === "MANUAL" ? "manual" : "online"})` : "Belum memilih") : "Tidak berhak memilih"}</span></li>)}
        </ul>
      ))}
    </div>
  );
}
