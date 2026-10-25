import { Download } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { loadElections, pickElection } from "@/lib/elections";
import { PageHeader, Table, th, td } from "@/components/admin/PageHeader";
import { ElectionTabs } from "@/components/admin/ElectionTabs";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { ElectionStatusBadge } from "@/components/election/ElectionStatusBadge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatNumber, formatPercent } from "@/lib/utils";
import { RT_LIST } from "@/lib/constants";
import { hasTie } from "@/lib/stats";

type R = { candidate_id: string; nomor_urut: number; nama: string; online_votes: number; manual_votes: number; total_votes: number };
type M = { candidate_id: string; nomor_urut: number; nama: string; jenis_kelamin: string; asal_rt: string; status: string; by_rt: Record<string, number>; total: number };

export default async function Hasil({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const staff = await requireStaff("hasil");
  const sp = await searchParams;
  const sb = await createServerSupabase();
  const all = await loadElections(sb);
  const list = staff.role === "KOORDINATOR_RT" ? all.filter((e) => e.neighborhood_id === staff.neighborhoodId) : all;
  const el = pickElection(list, sp.e);
  if (!el) return <Alert kind="warning">Belum ada pemilihan yang dapat Anda lihat.</Alert>;
  const { data, error } = await sb.rpc("get_election_results", { p_election_id: el.id });
  const rows = (data ?? []) as R[];
  const total = rows.reduce((a, r) => a + Number(r.total_votes), 0);
  const { data: rec } = await sb.rpc("manual_reconciliation", { p_election_id: el.id });
  const { data: mx } = el.type !== "RT" ? await sb.rpc("get_rw_matrix", { p_election: el.id }) : { data: null };
  const matrix = (mx ?? []) as M[];
  const live = el.status === "PEMILIHAN_BERLANGSUNG" || el.status === "PERHITUNGAN";

  return (
    <div className="space-y-5">
      {live && <AutoRefresh seconds={10} />}
      <PageHeader title="Hasil" subtitle="Peringkat hanya urutan tampilan. Penetapan pengurus mengikuti tata tertib panitia.">
        <Button asChild variant="outline"><a href={`/api/admin/export/hasil?e=${el.id}&format=xlsx`}><Download className="size-4" aria-hidden />Excel</a></Button>
        <Button asChild variant="outline"><a href={`/api/admin/export/hasil?e=${el.id}&format=csv`}>CSV</a></Button>
      </PageHeader>
      <ElectionTabs list={list} current={el.id} base="/admin/hasil" />
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-bold">{el.nama}</h2><ElectionStatusBadge status={el.status} /></div>
      {error && <Alert kind="error">Hasil belum dapat dimuat.</Alert>}
      {live && <Alert kind="info">Pemilihan masih berjalan: angka bersifat sementara.</Alert>}
      {hasTie(rows) && <Alert kind="warning"><b>TERDAPAT PEROLEHAN SUARA YANG SAMA.</b> Sistem tidak menentukan pemenang secara otomatis. Selesaikan sesuai tata tertib resmi panitia dan catat keputusan tersebut.</Alert>}
      {rec && !rec.balanced && <Alert kind="warning">Rekonsiliasi suara manual belum seimbang (selisih {rec.difference}).</Alert>}

      <Table caption="Perolehan suara">
        <thead><tr>{["Urutan", "No.", "Nama", "Online", "Manual", "Total suara", "Persentase"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td className={td} colSpan={7}>Belum ada calon.</td></tr>}
          {rows.map((r, i) => (
            <tr key={r.candidate_id}><td className={td}>{i + 1}</td><td className={td}>{String(r.nomor_urut).padStart(2, "0")}</td><td className={`${td} font-medium`}>{r.nama}</td>
              <td className={td}>{formatNumber(Number(r.online_votes))}</td><td className={td}>{formatNumber(Number(r.manual_votes))}</td>
              <td className={`${td} font-bold`}>{formatNumber(Number(r.total_votes))}</td><td className={td}>{formatPercent(Number(r.total_votes), total)}</td></tr>
          ))}
        </tbody>
      </Table>

      {el.type !== "RT" && (
        <section>
          <h2 className="mb-2 font-bold">Rekap bakal calon RW menurut RT asal suara</h2>
          <Table caption="Rekap bakal calon RW">
            <thead><tr>{["Nama", "JK", "Asal RT", ...RT_LIST.map((r) => r.replace("RT ", "RT")), "Total"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{matrix.map((m) => <tr key={m.candidate_id}><td className={`${td} font-medium`}>{m.nama}</td><td className={td}>{m.jenis_kelamin}</td><td className={td}>{m.asal_rt}</td>{RT_LIST.map((r) => <td key={r} className={td}>{m.by_rt[r] ?? 0}</td>)}<td className={`${td} font-bold`}>{m.total}</td></tr>)}</tbody>
          </Table>
          <p className="mt-2 text-xs text-muted-foreground">Rumus penentuan pengurus RW belum ditetapkan di sistem; menunggu keputusan panitia.</p>
        </section>
      )}
    </div>
  );
}
