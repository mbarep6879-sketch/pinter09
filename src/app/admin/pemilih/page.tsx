import Link from "next/link";
import { CheckCircle2, Circle, Download, Upload } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/roles";
import { PageHeader, Table, th, td } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/input";
import { KkSearch } from "@/components/admin/KkSearch";
import { formatNumber } from "@/lib/utils";
import { hak, totals, type Stats } from "@/lib/stats";
import type { VoterRow } from "@/server/actions/search";

const PER = 25;

export default async function Pemilih({ searchParams }: { searchParams: Promise<{ rt?: string; status?: string; q?: string; page?: string }> }) {
  const staff = await requireStaff("pemilih");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sb = await createServerSupabase();
  const [{ data: nb }, { data: st }] = await Promise.all([sb.from("neighborhoods").select("id, code").order("code"), sb.rpc("get_dashboard_stats")]);
  const rtId = sp.rt && nb?.some((n) => n.id === sp.rt) ? sp.rt : null;
  const status = sp.status === "SUDAH" || sp.status === "BELUM" ? sp.status : null;
  const { data: rows, error } = await sb.rpc("list_voters", { p_rt: rtId, p_status: status, p_q: sp.q?.slice(0, 60) || null, p_limit: PER, p_offset: (page - 1) * PER });
  const list = (rows ?? []) as (VoterRow & { total: number })[];
  const total = list[0]?.total ?? 0;
  const stats = st as Stats | null;
  const t = totals(stats?.rt ?? []);
  const qs = (o: Record<string, string | number | null | undefined>) => { const p = new URLSearchParams(); Object.entries({ rt: rtId, status, q: sp.q, ...o }).forEach(([k, v]) => v && p.set(k, String(v))); return `?${p}`; };
  const canImport = canAccess(staff.role, "import");

  return (
    <div className="space-y-6">
      <PageHeader title="Pemilih" subtitle="Nomor KK selalu ditampilkan tersamar. Hak suara: suami dan istri masing-masing 1 suara.">
        {canImport && <Button asChild><Link href="/admin/pemilih/import"><Upload className="size-4" aria-hidden />Import pemilih</Link></Button>}
        {canImport && <Button asChild variant="outline"><Link href="/admin/pemilih/undangan">Kode undangan</Link></Button>}
        <Button asChild variant="outline"><a href="/api/admin/export/pemilih?format=xlsx"><Download className="size-4" aria-hidden />Excel</a></Button>
        <Button asChild variant="outline"><a href="/api/admin/export/pemilih?format=csv">CSV</a></Button>
      </PageHeader>

      <Table caption="Rekap hak suara per RT">
        <thead><tr>{["RT", "Jumlah KK", "Laki-laki", "Perempuan", "Total hak suara"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {(stats?.rt ?? []).map((r) => <tr key={r.rt}><td className={`${td} font-semibold`}>{r.rt}</td><td className={td}>{formatNumber(r.kk)}</td><td className={td}>{formatNumber(r.berhak_l)}</td><td className={td}>{formatNumber(r.berhak_p)}</td><td className={td}>{formatNumber(hak(r))}</td></tr>)}
          <tr className="font-bold"><td className={td}>RW 09</td><td className={td}>{formatNumber(t.kk)}</td><td className={td}>{formatNumber(t.l)}</td><td className={td}>{formatNumber(t.p)}</td><td className={td}>{formatNumber(t.total)}</td></tr>
        </tbody>
      </Table>

      <KkSearch />

      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4" method="get">
        <label className="space-y-1.5"><span className="text-sm font-semibold">RT</span>
          <Select name="rt" defaultValue={rtId ?? ""}><option value="">Semua RT</option>{nb?.map((n) => <option key={n.id} value={n.id}>{n.code}</option>)}</Select></label>
        <label className="space-y-1.5"><span className="text-sm font-semibold">Status memilih</span>
          <Select name="status" defaultValue={status ?? ""}><option value="">Semua</option><option value="SUDAH">Sudah memilih</option><option value="BELUM">Belum memilih</option></Select></label>
        <label className="min-w-48 flex-1 space-y-1.5"><span className="text-sm font-semibold">Nama</span><Input name="q" defaultValue={sp.q ?? ""} placeholder="Cari nama" /></label>
        <Button type="submit">Terapkan</Button>
      </form>

      {error ? <p className="text-sm text-danger">Daftar belum dapat dimuat.</p> : (
        <>
          <Table caption="Daftar pemilih">
            <thead><tr>{["Nama", "JK", "Hubungan", "RT", "Alamat", "KK", "Hak suara", "Status"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {list.length === 0 && <tr><td className={td} colSpan={8}>Tidak ada data. {t.total === 0 && "Mulai dengan mengimport data pemilih."}</td></tr>}
              {list.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} font-medium`}>{r.nama}</td><td className={td}>{r.jenis_kelamin}</td><td className={td}>{r.hubungan}</td><td className={td}>{r.rt}</td>
                  <td className={td}>{r.alamat}</td><td className={`${td} font-mono`}>{r.kk_masked}</td><td className={td}>{r.has_voting_right ? "Berhak" : "Tidak berhak"}</td>
                  <td className={td}>{r.sudah_memilih ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-4" aria-hidden />Sudah ({r.channel === "MANUAL" ? "manual" : "online"})</span> : r.has_voting_right ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Circle className="size-4" aria-hidden />Belum</span> : "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{formatNumber(total)} data · halaman {page} dari {Math.max(1, Math.ceil(total / PER))}</span>
            <span className="flex gap-2">
              {page > 1 && <Button asChild variant="outline" size="sm"><Link href={qs({ page: page - 1 })}>Sebelumnya</Link></Button>}
              {page * PER < total && <Button asChild variant="outline" size="sm"><Link href={qs({ page: page + 1 })}>Berikutnya</Link></Button>}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
