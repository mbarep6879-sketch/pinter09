import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { ROLES, ROLE_LABEL } from "@/lib/auth/roles";
import { PageHeader, Table, th, td } from "@/components/admin/PageHeader";
import { ActionForm } from "@/components/admin/ActionForm";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { createStaffAction, setStaffActiveAction } from "@/server/actions/admin";

export default async function Pengguna() {
  const me = await requireStaff("pengguna");
  const sb = await createServerSupabase();
  const [{ data: users }, { data: nb }] = await Promise.all([
    sb.from("profiles").select("id, nama, role, is_active, neighborhoods(code)").order("created_at"), sb.from("neighborhoods").select("id, code").order("code"),
  ]);
  type U = { id: string; nama: string; role: keyof typeof ROLE_LABEL; is_active: boolean; neighborhoods: { code: string } | { code: string }[] | null };
  return (
    <div className="space-y-6">
      <PageHeader title="Pengguna panitia" subtitle="Hanya Super Admin. Koordinator RT dan Operator dapat dibatasi ke satu RT." />
      <Table caption="Daftar pengguna">
        <thead><tr>{["Nama", "Role", "RT tugas", "Status", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{((users ?? []) as unknown as U[]).map((u) => (
          <tr key={u.id}><td className={`${td} font-medium`}>{u.nama}</td><td className={td}>{ROLE_LABEL[u.role]}</td>
            <td className={td}>{(Array.isArray(u.neighborhoods) ? u.neighborhoods[0] : u.neighborhoods)?.code ?? "Semua"}</td>
            <td className={td}>{u.is_active ? "Aktif" : "Nonaktif"}</td>
            <td className={td}>{u.id !== me.id && <ActionForm action={setStaffActiveAction} submit={u.is_active ? "Nonaktifkan" : "Aktifkan"} size="sm" variant="outline" silent confirm={u.is_active ? `Nonaktifkan ${u.nama}?` : undefined}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="active" value={u.is_active ? "0" : "1"} /></ActionForm>}</td></tr>
        ))}</tbody>
      </Table>
      <Card>
        <h2 className="mb-3 font-bold">Tambah pengguna</h2>
        <ActionForm action={createStaffAction} submit="Buat akun" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nama"><Input name="nama" required /></Field>
            <Field label="Email"><Input type="email" name="email" required autoComplete="off" /></Field>
            <Field label="Role"><Select name="role" defaultValue="OPERATOR">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
            <Field label="RT tugas" hint="Wajib untuk Koordinator RT; opsional untuk Operator."><Select name="neighborhood_id" defaultValue=""><option value="">— semua RT —</option>{nb?.map((n) => <option key={n.id} value={n.id}>{n.code}</option>)}</Select></Field>
            <Field label="Kata sandi sementara" hint="Minimal 10 karakter."><Input type="password" name="password" minLength={10} required autoComplete="new-password" /></Field>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
