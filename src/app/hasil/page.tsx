import type { Metadata } from "next";
import Link from "next/link";
import { createAnonClient } from "@/lib/supabase/admin";
import { loadPublicElections } from "@/lib/public-data";
import { PrintButton } from "@/components/admin/PrintButton";
import { hasTie } from "@/lib/stats";
import { formatNumber, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Rekap hasil pemilihan" };
export const dynamic = "force-dynamic";

type Row = { nomor_urut: number; nama: string; total_votes: number };

export default async function HasilPublik() {
  const loaded = await loadPublicElections();
  const done = (loaded ?? []).filter((e) => e.status === "SELESAI" || e.status === "DITETAPKAN");
  const sb = done.length ? createAnonClient() : null;
  const results = await Promise.all(done.map(async (e) => {
    const { data } = await sb!.rpc("get_public_results", { p_election_id: e.id });
    return { e, rows: ((data ?? []) as Row[]) };
  }));
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/" className="no-print text-sm underline">← Beranda</Link>
      <div className="mb-1 mt-3 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-extrabold">Rekap hasil pemilihan</h1><PrintButton /></div>
      <p className="mb-6 text-muted-foreground">Hanya hasil yang sudah diselesaikan panitia. Tidak menampilkan data pribadi maupun siapa memilih siapa.</p>
      {loaded === null && <p role="alert" className="rounded-lg border border-danger bg-danger-soft p-4 text-sm text-danger">Data belum dapat dimuat saat ini. Silakan muat ulang halaman beberapa saat lagi, atau hubungi panitia.</p>}
      {loaded !== null && results.length === 0 && <p className="rounded-lg border bg-card p-6 text-center text-muted-foreground">Belum ada hasil yang diumumkan.</p>}
      <div className="space-y-6">
        {results.map(({ e, rows }) => {
          const total = rows.reduce((a, r) => a + Number(r.total_votes), 0);
          return (
            <section key={e.id} className="rounded-lg border bg-card p-5">
              <h2 className="text-lg font-bold">{e.nama}</h2>
              {e.method === "MUSYAWARAH" ? <p className="mt-2 text-sm text-muted-foreground">Dilaksanakan melalui musyawarah warga. Pengurus terpilih tercantum dalam Berita Acara.</p> : (
                <>
                  {hasTie(rows) && <p className="mt-2 rounded-md bg-warning-soft p-2 text-sm font-semibold text-warning">Terdapat perolehan suara yang sama. Penetapan mengikuti tata tertib panitia.</p>}
                  <ol className="mt-3 space-y-2">
                    {rows.map((r) => (
                      <li key={r.nomor_urut}>
                        <div className="flex justify-between gap-3 text-sm"><span><b>{String(r.nomor_urut).padStart(2, "0")}</b> {r.nama}</span><span className="tabular-nums">{formatNumber(Number(r.total_votes))} suara · {formatPercent(Number(r.total_votes), total)}</span></div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${total ? (Number(r.total_votes) / total) * 100 : 0}%` }} /></div>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-xs text-muted-foreground">Total suara tercatat: {formatNumber(total)}.</p>
                </>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
