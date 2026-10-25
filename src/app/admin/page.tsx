import { CheckCircle2, Percent, UserCheck, UserX, Users } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { StatCard } from "@/components/election/StatCard";
import { ElectionStatusBadge } from "@/components/election/ElectionStatusBadge";
import { ElectionTimeline } from "@/components/election/ElectionTimeline";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Table, th, td } from "@/components/admin/PageHeader";
import { formatNumber, formatPercent } from "@/lib/utils";
import { hak, stepState, sudah, totals, type Stats } from "@/lib/stats";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ akses?: string }> }) {
  await requireStaff("dashboard");
  const { akses } = await searchParams;
  const sb = await createServerSupabase();
  const { data, error } = await sb.rpc("get_dashboard_stats");
  const stats = data as Stats | null;
  const t = totals(stats?.rt ?? []);

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <div>
        <h1 className="text-2xl font-extrabold">Pemilihan Pengurus RT &amp; RW 09</h1>
        <p className="mt-1 inline-flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" aria-hidden /> Sistem aktif · data diperbarui otomatis tiap 15 detik</p>
      </div>
      {akses === "ditolak" && <Alert kind="warning">Anda tidak memiliki kewenangan untuk membuka halaman tersebut.</Alert>}
      {error && <Alert kind="error">Data dashboard belum dapat dimuat. Coba muat ulang halaman.</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total pemilih (hak suara)" value={formatNumber(t.total)} hint={`${formatNumber(t.kk)} KK · ${formatNumber(t.l)} laki-laki · ${formatNumber(t.p)} perempuan`} icon={Users} />
        <StatCard label="Sudah memilih" value={formatNumber(t.voted)} hint={`${formatNumber(t.on)} online · ${formatNumber(t.man)} manual`} icon={UserCheck} />
        <StatCard label="Belum memilih" value={formatNumber(t.belum)} icon={UserX} />
        <StatCard label="Partisipasi" value={formatPercent(t.voted, t.total)} icon={Percent} />
      </div>

      <Card>
        <h2 className="mb-3 font-bold">Tahapan</h2>
        <ElectionTimeline steps={[
          ...(stats?.rt ?? []).map((r) => ({ label: r.rt, state: stepState(r.status) })),
          { label: "RW 09", state: stats?.rw ? stepState(stats.rw.status) : "todo" },
        ]} />
      </Card>

      <div>
        <h2 className="mb-2 font-bold">Rekap per RT</h2>
        <Table caption="Rekap pemilih dan partisipasi per RT">
          <thead><tr>{["RT", "Status", "KK", "Laki-laki", "Perempuan", "Hak suara", "Online", "Manual", "Partisipasi"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(stats?.rt ?? []).map((r) => (
              <tr key={r.rt}>
                <td className={`${td} font-semibold`}>{r.rt}</td>
                <td className={td}><ElectionStatusBadge status={r.status} /></td>
                <td className={td}>{formatNumber(r.kk)}</td><td className={td}>{formatNumber(r.berhak_l)}</td><td className={td}>{formatNumber(r.berhak_p)}</td>
                <td className={td}>{formatNumber(hak(r))}</td><td className={td}>{formatNumber(r.sudah_online)}</td><td className={td}>{formatNumber(r.sudah_manual)}</td>
                <td className={td}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Partisipasi ${formatPercent(sudah(r), hak(r))}`}><div className="h-full bg-primary transition-all duration-500" style={{ width: `${hak(r) ? Math.min(100, (sudah(r) / hak(r)) * 100) : 0}%` }} /></div>
                    <span className="tabular-nums">{formatPercent(sudah(r), hak(r))}</span>
                  </div>
                </td>
              </tr>
            ))}
            {stats?.rt.length ? (
              <tr className="font-bold"><td className={td}>Total RW 09</td><td className={td} /><td className={td}>{formatNumber(t.kk)}</td><td className={td}>{formatNumber(t.l)}</td><td className={td}>{formatNumber(t.p)}</td><td className={td}>{formatNumber(t.total)}</td><td className={td}>{formatNumber(t.on)}</td><td className={td}>{formatNumber(t.man)}</td><td className={td}>{formatPercent(t.voted, t.total)}</td></tr>
            ) : null}
          </tbody>
        </Table>
      </div>

      {stats?.rw && (
        <Card><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Penjaringan Bakal Calon RW 09</h2><ElectionStatusBadge status={stats.rw.status} /></div>
          <p className="mt-2 text-sm text-muted-foreground">{formatNumber(stats.rw.sudah)} peserta sudah memberikan suara penjaringan.</p></Card>
      )}
    </div>
  );
}
