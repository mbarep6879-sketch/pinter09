import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { canWrite } from "@/lib/auth/roles";
import { loadElections, type Election } from "@/lib/elections";
import { ELECTION_STATUSES, STATUS_LABEL, type ElectionStatus } from "@/lib/constants";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm } from "@/components/admin/ActionForm";
import { ShareLink } from "@/components/admin/ShareLink";
import { ElectionStatusBadge } from "@/components/election/ElectionStatusBadge";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { saveElectionConfigAction, saveMusyawarahAction, setStatusAction } from "@/server/actions/admin";

type Move = { to: ElectionStatus; label: string; confirm?: string; back?: boolean };
const NEXT_LABEL: Partial<Record<ElectionStatus, { label: string; confirm?: string }>> = {
  TERJADWAL: { label: "Jadwalkan" },
  PERSIAPAN: { label: "Mulai persiapan" },
  PEMILIHAN_BERLANGSUNG: { label: "Buka pemilihan", confirm: "Buka pemilihan sekarang? Warga dapat langsung memberikan suara dan calon tidak dapat ditambah lagi." },
  PERHITUNGAN: { label: "Tutup pemilihan & mulai perhitungan", confirm: "Tutup pemilihan? Warga tidak dapat memberikan suara lagi, dan pemilihan TIDAK dapat dibuka kembali." },
  SELESAI: { label: "Selesaikan & kunci hasil", confirm: "Kunci hasil? Setelah dikunci, perubahan hanya melalui prosedur koreksi resmi." },
  DITETAPKAN: { label: "Tetapkan hasil", confirm: "Tetapkan hasil secara resmi?" },
};

function moves(e: Election): Move[] {
  const order: ElectionStatus[] = e.method === "MUSYAWARAH" ? ["DRAFT", "TERJADWAL", "PERSIAPAN", "SELESAI", "DITETAPKAN"] : [...ELECTION_STATUSES];
  const i = order.indexOf(e.status); const out: Move[] = [];
  if (i >= 0 && i < order.length - 1) out.push({ to: order[i + 1], ...(NEXT_LABEL[order[i + 1]] ?? { label: STATUS_LABEL[order[i + 1]] }) });
  const lim = e.method === "MUSYAWARAH" ? 2 : 2; // mundur hanya sebelum pemungutan/penyelesaian
  if (i > 0 && i <= lim) out.push({ to: order[i - 1], label: `Kembali ke ${STATUS_LABEL[order[i - 1]]}`, back: true });
  return out;
}

export default async function Pemilihan() {
  const staff = await requireStaff("pemilihan");
  const sb = await createServerSupabase();
  const elections = await loadElections(sb);
  const { data: cs } = await sb.from("candidates").select("election_id, status");
  const count = (id: string, st?: string[]) => (cs ?? []).filter((c) => c.election_id === id && (!st || st.includes(c.status))).length;
  const write = canWrite(staff.role, "pemilihan");

  return (
    <div className="space-y-5">
      <PageHeader title="Pemilihan" subtitle="Atur metode, jumlah pilihan, dan ubah status. Pemungutan suara hanya dapat dilakukan warga saat status “Pemilihan berlangsung”." />
      <Alert kind="info">Jumlah pilihan maksimal dan metode <b>tidak diberi nilai bawaan</b>: panitia yang menetapkannya. Pemilihan tidak dapat dibuka sebelum keduanya diisi dan ada calon yang sah.</Alert>
      {elections.map((e) => {
        const locked = ["PEMILIHAN_BERLANGSUNG", "PERHITUNGAN", "SELESAI", "DITETAPKAN"].includes(e.status);
        const sahCount = count(e.id, e.type === "RT" ? ["CALON_TETAP"] : ["BAKAL_CALON", "CALON_TETAP"]);
        const m = e.config?.musyawarah;
        return (
          <Card key={e.id} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">{e.nama}</h2><ElectionStatusBadge status={e.status} /></div>
            <ul className="grid gap-1 text-sm sm:grid-cols-3">
              <li>Metode: <b>{e.method === "VOTING" ? "Pemilihan dengan suara" : e.method === "MUSYAWARAH" ? "Musyawarah warga" : "Belum ditetapkan"}</b></li>
              <li>Pilihan maksimal: <b>{e.max_choices ?? "Belum ditetapkan"}</b></li>
              <li>Calon sah: <b>{sahCount}</b> dari {count(e.id)}</li>
            </ul>

            {write && (
              <ActionForm action={saveElectionConfigAction} submit="Simpan konfigurasi" variant="outline" className="space-y-3 rounded-md border p-3">
                <input type="hidden" name="election_id" value={e.id} />
                <fieldset disabled={locked} className="grid gap-3 sm:grid-cols-2">
                  <Field label="Metode"><Select name="method" defaultValue={e.method ?? ""}><option value="">— pilih —</option><option value="VOTING">Pemilihan dengan suara</option><option value="MUSYAWARAH">Musyawarah warga</option></Select></Field>
                  <Field label="Jumlah pilihan maksimal per pemilih" hint="Kosongkan bila belum diputuskan."><Input type="number" name="max_choices" min={1} max={20} defaultValue={e.max_choices ?? ""} /></Field>
                </fieldset>
                {locked && <p className="text-xs text-muted-foreground">Konfigurasi terkunci setelah pemilihan dimulai.</p>}
              </ActionForm>
            )}

            {e.method === "MUSYAWARAH" && write && !["SELESAI", "DITETAPKAN"].includes(e.status) && (
              <ActionForm action={saveMusyawarahAction} submit="Simpan hasil musyawarah" variant="outline" className="space-y-3 rounded-md border p-3">
                <input type="hidden" name="election_id" value={e.id} />
                <h3 className="font-semibold">Catatan hasil musyawarah</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tanggal"><Input type="date" name="tanggal" defaultValue={m?.tanggal ?? ""} /></Field>
                  <Field label="Jumlah peserta"><Input type="number" name="peserta" min={0} defaultValue={m?.peserta ?? ""} required /></Field>
                </div>
                <Field label="Hasil / kesepakatan"><Textarea name="hasil" defaultValue={m?.hasil ?? ""} /></Field>
                <Field label="Pengurus terpilih" hint="Satu per baris, format: Nama - Jabatan"><Textarea name="pengurus" defaultValue={m?.pengurus.map((p) => `${p.nama} - ${p.jabatan}`).join("\n") ?? ""} required /></Field>
                <Field label="Catatan"><Textarea name="catatan" defaultValue={m?.catatan ?? ""} /></Field>
              </ActionForm>
            )}
            {e.method === "MUSYAWARAH" && m && ["SELESAI", "DITETAPKAN"].includes(e.status) && (
              <div className="rounded-md bg-muted p-3 text-sm"><p><b>Peserta:</b> {m.peserta}</p><p><b>Pengurus terpilih:</b> {m.pengurus.map((p) => `${p.nama} (${p.jabatan})`).join("; ")}</p></div>
            )}

            {e.status === "PEMILIHAN_BERLANGSUNG" && e.type === "RT" && e.rt && (
              <div><p className="mb-1 text-sm font-semibold">Bagikan tautan pemilihan</p><ShareLink path={`/pilih/${e.rt.replace(" ", "").toLowerCase()}`} title={`PEMILIHAN PENGURUS ${e.rt} RW 09`} /></div>
            )}

            {write && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {moves(e).map((mv) => (
                  <ActionForm key={mv.to} action={setStatusAction} submit={mv.label} variant={mv.back ? "outline" : "default"} confirm={mv.confirm} silent>
                    <input type="hidden" name="election_id" value={e.id} /><input type="hidden" name="to" value={mv.to} />
                  </ActionForm>
                ))}
                {moves(e).length === 0 && <p className="text-sm text-muted-foreground">Tidak ada perubahan status lanjutan.</p>}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
