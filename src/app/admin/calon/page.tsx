import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { canWrite } from "@/lib/auth/roles";
import { loadElections, pickElection } from "@/lib/elections";
import { PageHeader, Table, th, td } from "@/components/admin/PageHeader";
import { ElectionTabs } from "@/components/admin/ElectionTabs";
import { ActionForm } from "@/components/admin/ActionForm";
import { Alert } from "@/components/ui/alert";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addCandidateAction, removeCandidateAction, setCandidateStatusAction } from "@/server/actions/admin";
import type { VoterRow } from "@/server/actions/search";

const STATUS = [["BAKAL_CALON", "Bakal calon"], ["CALON_TETAP", "Calon tetap"], ["MENGUNDURKAN_DIRI", "Mengundurkan diri"], ["TIDAK_AKTIF", "Tidak aktif"], ["TERPILIH", "Terpilih"]] as const;
const JK = { L: "Laki-laki", P: "Perempuan" } as const;

export default async function Calon({ searchParams }: { searchParams: Promise<{ e?: string; q?: string }> }) {
  const staff = await requireStaff("calon");
  const sp = await searchParams;
  const sb = await createServerSupabase();
  const elections = await loadElections(sb);
  const el = pickElection(elections, sp.e);
  if (!el) return <Alert kind="warning">Belum ada pemilihan.</Alert>;
  const write = canWrite(staff.role, "calon");
  const editable = ["DRAFT", "TERJADWAL", "PERSIAPAN"].includes(el.status);

  type C = { id: string; nomor_urut: number; status: string; voters: { nama: string; jenis_kelamin: "L" | "P"; alamat: string; neighborhoods: { code: string } | { code: string }[] | null } | null };
  const { data } = await sb.from("candidates").select("id, nomor_urut, status, voters(nama, jenis_kelamin, alamat, neighborhoods(code))").eq("election_id", el.id).order("nomor_urut");
  const cands = (data ?? []) as unknown as C[];
  const q = sp.q?.trim().slice(0, 60);
  const { data: found } = q && write && editable ? await sb.rpc("list_voters", { p_rt: el.neighborhood_id, p_q: q, p_limit: 15, p_offset: 0 }) : { data: [] };
  const taken = new Set(cands.map((c) => c.voters?.nama + "|" + c.voters?.alamat));
  const results = ((found ?? []) as VoterRow[]).filter((v) => v.has_voting_right);

  return (
    <div>
      <PageHeader title="Calon" subtitle={el.type === "RT" ? "Calon pengurus RT harus warga RT yang sama. Nomor urut diberikan otomatis." : "Bakal calon RW dapat berasal dari RT mana pun; asal RT ditampilkan dengan jelas."} />
      <ElectionTabs list={elections} current={el.id} base="/admin/calon" />
      {!editable && <Alert kind="info" className="mb-4">Pemilihan sudah dimulai/selesai: calon baru tidak dapat ditambahkan. Status calon yang mengundurkan diri tetap dapat diubah selama belum selesai.</Alert>}

      <Table caption={`Daftar calon ${el.label}`}>
        <thead><tr>{["No.", "Nama", "Jenis kelamin", "Asal RT", "Alamat", "Status", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {cands.length === 0 && <tr><td className={td} colSpan={7}>Belum ada calon.</td></tr>}
          {cands.map((c) => {
            const v = c.voters; const rt = Array.isArray(v?.neighborhoods) ? v?.neighborhoods[0]?.code : v?.neighborhoods?.code;
            return (
              <tr key={c.id}>
                <td className={`${td} font-bold`}>{String(c.nomor_urut).padStart(2, "0")}</td><td className={`${td} font-medium`}>{v?.nama}</td>
                <td className={td}>{v ? JK[v.jenis_kelamin] : ""}</td><td className={td}>{rt}</td><td className={td}>{v?.alamat}</td>
                <td className={td}>
                  {write ? (
                    <ActionForm action={setCandidateStatusAction} className="flex items-center gap-2" submit="Simpan" size="sm" variant="outline" silent>
                      <input type="hidden" name="candidate_id" value={c.id} />
                      <Select name="status" defaultValue={c.status} className="h-9 w-44">{STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
                    </ActionForm>
                  ) : STATUS.find(([k]) => k === c.status)?.[1]}
                </td>
                <td className={td}>{write && editable && <ActionForm action={removeCandidateAction} confirm="Hapus calon ini?" submit="Hapus" size="sm" variant="ghost" silent><input type="hidden" name="candidate_id" value={c.id} /></ActionForm>}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {el.type === "RT" && <p className="mt-2 text-xs text-muted-foreground">Calon baru dapat dipilih warga hanya setelah statusnya <b>Calon tetap</b>.</p>}

      {write && editable && (
        <section className="mt-8">
          <h2 className="mb-2 font-bold">Tambah calon</h2>
          <form method="get" className="mb-3 flex gap-2"><input type="hidden" name="e" value={el.id} /><Input name="q" defaultValue={q ?? ""} placeholder={`Cari nama warga${el.rt ? ` ${el.rt}` : ""}`} className="max-w-sm" /><Button type="submit">Cari</Button></form>
          {q && results.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada warga berhak yang cocok.</p>}
          <ul className="divide-y rounded-lg border bg-card">
            {results.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span><b>{v.nama}</b> · {JK[v.jenis_kelamin]} · {v.rt} · {v.alamat}{taken.has(v.nama + "|" + v.alamat) && " (sudah menjadi calon)"}</span>
                <ActionForm action={addCandidateAction} submit="Jadikan calon" size="sm" silent><input type="hidden" name="election_id" value={el.id} /><input type="hidden" name="voter_id" value={v.id} /></ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
