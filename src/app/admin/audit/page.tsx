import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";
import { PageHeader, Table, th, td } from "@/components/admin/PageHeader";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";

const LABEL: Record<string, string> = {
  LOGIN: "Masuk", LOGOUT: "Keluar", IMPORT_VOTERS: "Import pemilih", IMPORT_DISCARDED: "Impor dibatalkan", INSERT: "Tambah data", UPDATE: "Ubah data", DELETE: "Hapus data",
  MANUAL_PARTICIPATION: "Tandai memilih manual", RATE_LIMIT_EXCEEDED: "Batas percobaan terlampaui (mencurigakan)", EXPORT_VOTERS: "Ekspor pemilih", EXPORT_RESULTS: "Ekspor hasil",
  INVITE_CODES_GENERATED: "Buat kode undangan", STAFF_CREATED: "Buat akun panitia",
};

export default async function Audit({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  await requireStaff("audit");
  const { a } = await searchParams;
  const sb = await createServerSupabase();
  let q = sb.from("audit_logs").select("id, actor, action, entity, entity_id, before_data, after_data, created_at").order("id", { ascending: false }).limit(200);
  if (a && /^[A-Z_]{3,40}$/.test(a)) q = q.eq("action", a);
  const { data } = await q;
  const ids = [...new Set((data ?? []).map((r) => r.actor).filter(Boolean))] as string[];
  const { data: prof } = ids.length ? await createAdminClient().from("profiles").select("id, nama").in("id", ids) : { data: [] };
  const names = new Map((prof ?? []).map((p) => [p.id as string, p.nama as string]));

  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" subtitle="Catatan aktivitas penting. Tidak dapat diubah atau dihapus oleh siapa pun melalui aplikasi." />
      <form className="flex items-end gap-3" method="get">
        <label className="space-y-1.5"><span className="text-sm font-semibold">Jenis aktivitas</span>
          <Select name="a" defaultValue={a ?? ""}><option value="">Semua</option>{Object.entries(LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></label>
        <Button type="submit">Terapkan</Button>
      </form>
      <Table caption="Audit log">
        <thead><tr>{["Waktu", "Pelaku", "Aktivitas", "Objek", "Rincian"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {(data ?? []).length === 0 && <tr><td className={td} colSpan={5}>Belum ada catatan.</td></tr>}
          {(data ?? []).map((r) => (
            <tr key={r.id}>
              <td className={`${td} whitespace-nowrap`}>{fmtDateTime(r.created_at)}</td>
              <td className={td}>{r.actor ? names.get(r.actor) ?? `${String(r.actor).slice(0, 8)}…` : "Sistem/warga"}</td>
              <td className={td}>{LABEL[r.action] ?? r.action}</td><td className={td}>{r.entity ?? "-"}</td>
              <td className={td}>{(r.before_data || r.after_data) ? <details><summary className="cursor-pointer text-primary">Lihat</summary><pre className="mt-1 max-w-md whitespace-pre-wrap text-xs">{JSON.stringify({ sebelum: r.before_data, sesudah: r.after_data }, null, 1)}</pre></details> : "-"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="text-xs text-muted-foreground">Menampilkan 200 catatan terbaru.</p>
    </div>
  );
}
