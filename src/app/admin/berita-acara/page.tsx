import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { canWrite } from "@/lib/auth/roles";
import { loadElections } from "@/lib/elections";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm } from "@/components/admin/ActionForm";
import { ElectionStatusBadge } from "@/components/election/ElectionStatusBadge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { BaButtons } from "@/components/admin/BaButtons";
import { saveBeritaAcaraAction } from "@/server/actions/admin";

export default async function BeritaAcara() {
  const staff = await requireStaff("berita-acara");
  const sb = await createServerSupabase();
  const [elections, { data: bas }] = await Promise.all([loadElections(sb), sb.from("berita_acara").select("election_id, nomor_dokumen, locked_at, snapshot")]);
  const ba = new Map((bas ?? []).map((b) => [b.election_id as string, b]));
  const write = canWrite(staff.role, "berita-acara");
  const done = elections.filter((e) => e.status === "SELESAI" || e.status === "DITETAPKAN");

  return (
    <div className="space-y-5">
      <PageHeader title="Berita Acara" subtitle="Angka diambil otomatis dari database. Panitia hanya melengkapi nama pejabat, saksi, dan catatan." />
      <Alert kind="info">Berita Acara dapat dibuat setelah pemilihan berstatus <b>Selesai</b>. Setelah difinalisasi dokumen terkunci. Hasil cetak/PDF memakai tombol cetak browser (Simpan sebagai PDF).</Alert>
      {done.length === 0 && <Alert kind="warning">Belum ada pemilihan yang selesai.</Alert>}
      {done.map((e) => {
        const b = ba.get(e.id); const meta = (b?.snapshot as { meta?: Record<string, string> } | undefined)?.meta ?? {};
        const locked = !!b?.locked_at;
        return (
          <Card key={e.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{e.nama}</h2>
              <span className="flex items-center gap-2"><ElectionStatusBadge status={e.status} />{locked && <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">Final · terkunci</span>}</span>
            </div>
            <p className="text-sm text-muted-foreground">Nomor dokumen: <b>{b?.nomor_dokumen ?? (b ? "belum ada (format nomor belum ditetapkan di Pengaturan)" : "—")}</b></p>
            {write && !locked && (
              <ActionForm action={saveBeritaAcaraAction} className="space-y-3">
                <input type="hidden" name="election_id" value={e.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tempat"><Input name="tempat" defaultValue={meta.tempat ?? ""} /></Field>
                  <Field label="Tanggal penandatanganan"><Input type="date" name="tanggal" defaultValue={meta.tanggal ?? ""} /></Field>
                  <Field label="Ketua panitia"><Input name="ketua" defaultValue={meta.ketua ?? ""} /></Field>
                  <Field label="Sekretaris"><Input name="sekretaris" defaultValue={meta.sekretaris ?? ""} /></Field>
                  <Field label="Saksi 1"><Input name="saksi1" defaultValue={meta.saksi1 ?? ""} /></Field>
                  <Field label="Saksi 2"><Input name="saksi2" defaultValue={meta.saksi2 ?? ""} /></Field>
                </div>
                <Field label="Catatan"><Textarea name="catatan" defaultValue={meta.catatan ?? ""} /></Field>
                <BaButtons />
              </ActionForm>
            )}
            {b && <Button asChild variant="outline"><Link href={`/admin/berita-acara/${e.id}`}>Pratinjau &amp; cetak</Link></Button>}
          </Card>
        );
      })}
    </div>
  );
}
