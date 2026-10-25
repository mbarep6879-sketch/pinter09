import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm } from "@/components/admin/ActionForm";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { saveSettingAction } from "@/server/actions/admin";

const TEXT: { key: string; label: string; hint: string }[] = [
  { key: "doc.nomor_format", label: "Format nomor Berita Acara", hint: "Token: {seq} nomor urut, {rt} kode RT, {rw}, {year}. Contoh: {seq}/BA/{rt}/RW{rw}/{year}. Kosong = nomor diisi manual." },
  { key: "rule.rw_selection_method", label: "Metode pemilihan/penjaringan RW", hint: "Catatan aturan resmi. Sistem tidak mengarang rumus penetapan." },
  { key: "rule.tie_break", label: "Aturan perolehan suara sama (tie-break)", hint: "Catatan aturan resmi. Sistem tidak menentukan pemenang otomatis." },
  { key: "rule.invalid_vote_policy", label: "Kebijakan suara tidak sah / kosong", hint: "Catatan aturan resmi." },
  { key: "rule.rw_top_n_from_rt", label: "Jumlah bakal calon RW dari tiap RT", hint: "Catatan aturan resmi (misalnya 5 teratas)." },
];

export default async function Pengaturan() {
  await requireStaff("pengaturan");
  const sb = await createServerSupabase();
  const { data } = await sb.from("settings").select("key, value");
  const v = (k: string) => { const x = data?.find((d) => d.key === k)?.value; return typeof x === "string" ? x : ""; };
  return (
    <div className="space-y-5">
      <PageHeader title="Pengaturan pemilihan" subtitle="Aturan resmi ditetapkan panitia; sistem tidak mengisi nilai bawaan. Setiap perubahan tercatat di audit log." />
      <Card>
        <h2 className="font-bold">Faktor kedua verifikasi pemilih</h2>
        <p className="mb-3 text-sm text-muted-foreground">Tanpa faktor kedua, siapa pun yang mengetahui Nomor KK dapat memilih atas nama suami/istri dalam KK itu. Buat dan bagikan kode di menu Pemilih → Kode undangan <b>sebelum</b> mengaktifkan.</p>
        <ActionForm action={saveSettingAction} submit="Simpan" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="key" value="rule.second_factor" />
          <Field label="Faktor kedua"><Select name="value" defaultValue={v("rule.second_factor") || "NONE"}><option value="NONE">Tidak digunakan</option><option value="INVITE_CODE">Kode undangan per KK</option></Select></Field>
        </ActionForm>
      </Card>
      {TEXT.map((t) => (
        <Card key={t.key}>
          <ActionForm action={saveSettingAction} submit="Simpan" className="space-y-3">
            <input type="hidden" name="key" value={t.key} />
            <Field label={t.label} hint={t.hint}><Input name="value" defaultValue={v(t.key)} maxLength={300} /></Field>
          </ActionForm>
        </Card>
      ))}
      <Alert kind="info">Jumlah pilihan maksimal per RT dan metode (suara/musyawarah) diatur per pemilihan di menu <b>Pemilihan</b>.</Alert>
    </div>
  );
}
