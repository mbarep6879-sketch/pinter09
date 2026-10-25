"use client";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Table, th, td } from "@/components/admin/PageHeader";
import { commitImportAction, discardImportAction, previewImportAction, type ImportState } from "@/server/actions/import";

export function ImportWizard() {
  const [prev, previewAction] = useActionState<ImportState, FormData>(previewImportAction, {});
  const [commit, commitAction] = useActionState<ImportState, FormData>(commitImportAction, {});
  const [disc, discardAction] = useActionState<ImportState, FormData>(discardImportAction, {});
  const [partial, setPartial] = useState(false);
  const p = prev.preview;
  const finished = commit.done || disc.discarded;
  const errorCount = p ? p.summary.fileErrors + p.summary.conflicts : 0;

  if (commit.done) return <Alert kind="success"><p className="font-semibold">Import selesai.</p><p>{commit.done.voters_added} pemilih dan {commit.done.households_added} KK baru ditambahkan.</p></Alert>;
  if (disc.discarded) return <Alert kind="info">Impor dibatalkan. Tidak ada data yang masuk.</Alert>;

  return (
    <div className="space-y-6">
      <form action={previewAction} className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-bold">1. Pilih berkas</h2>
        <p className="text-sm text-muted-foreground">Format .xlsx atau .csv, maksimal 5 MB. Kolom: <b>Nomor KK, Nama, Jenis Kelamin, Alamat, RT, Hubungan</b> (Suami/Istri/Anak/Lainnya). Format kolom Nomor KK harus <b>Teks</b>.</p>
        <Input type="file" name="file" accept=".xlsx,.csv" required />
        <SubmitButton pendingText="Memeriksa berkas...">Periksa &amp; tampilkan pratinjau</SubmitButton>
        {prev.error && <Alert kind="error">{prev.error}</Alert>}
      </form>

      {p && !finished && (
        <div className="space-y-4">
          <h2 className="font-bold">2. Pratinjau (belum ada data yang masuk)</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[["Total baris", p.summary.totalRows], ["Pemilih baru", p.summary.newVoters], ["KK baru", p.summary.newHouseholds], ["Sudah terdaftar", p.summary.alreadyExists], ["Bermasalah", errorCount]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-bold">{v}</p></div>
            ))}
          </div>
          {p.warnings.map((w) => <Alert key={w} kind="warning">{w}</Alert>)}
          {p.summary.conflicts > 0 && <Alert kind="error">{p.summary.conflicts} baris memakai KK yang sudah terdaftar di RT lain.</Alert>}
          {p.errors.length > 0 && (
            <Table caption="Baris bermasalah">
              <thead><tr><th className={th}>Baris</th><th className={th}>KK</th><th className={th}>Masalah</th></tr></thead>
              <tbody>{p.errors.map((e, i) => <tr key={i}><td className={td}>{e.rowNo}</td><td className={`${td} font-mono`}>{e.kkMasked}</td><td className={td}>{e.message}</td></tr>)}</tbody>
            </Table>
          )}
          <Table caption="Contoh data yang akan diimport">
            <thead><tr>{["Baris", "KK", "Nama", "JK", "RT", "Hubungan", "Status"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{p.sample.map((s) => <tr key={s.rowNo}><td className={td}>{s.rowNo}</td><td className={`${td} font-mono`}>{s.kkMasked}</td><td className={td}>{s.nama}</td><td className={td}>{s.jk}</td><td className={td}>{s.rt}</td><td className={td}>{s.hubungan}</td><td className={td}>{s.status === "NEW" ? "Baru" : s.status === "EXISTS" ? "Sudah ada" : "Konflik"}</td></tr>)}</tbody>
          </Table>
          <p className="text-xs text-muted-foreground">Menampilkan 30 baris pertama.</p>

          <h2 className="font-bold">3. Konfirmasi</h2>
          <form action={commitAction} className="space-y-3 rounded-lg border bg-card p-4">
            <input type="hidden" name="batch_id" value={p.batchId} />
            {errorCount > 0 && (
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="allow_partial" value="1" checked={partial} onChange={(e) => setPartial(e.target.checked)} className="mt-1 size-4" />
                <span>Saya mengerti ada {errorCount} baris bermasalah yang <b>tidak akan diimport</b>, dan saya setuju mengimport hanya baris yang valid.</span></label>
            )}
            <div className="flex flex-wrap gap-3">
              <SubmitButton disabled={(errorCount > 0 && !partial) || p.summary.newVoters === 0} pendingText="Mengimport...">Konfirmasi &amp; import {p.summary.newVoters} pemilih</SubmitButton>
            </div>
            {commit.error && <Alert kind="error">{commit.error}</Alert>}
          </form>
          <form action={discardAction}><input type="hidden" name="batch_id" value={p.batchId} /><Button type="submit" variant="outline">Batalkan impor</Button></form>
          {disc.error && <Alert kind="error">{disc.error}</Alert>}
        </div>
      )}
    </div>
  );
}
