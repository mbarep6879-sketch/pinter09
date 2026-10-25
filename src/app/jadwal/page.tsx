import type { Metadata } from "next";
import Link from "next/link";
import { ElectionStatusBadge } from "@/components/election/ElectionStatusBadge";
import { ScheduleCalendar } from "@/components/election/ScheduleCalendar";
import { loadPublicElections } from "@/lib/public-data";
import { fmtDate, fmtTime } from "@/lib/format";

export const metadata: Metadata = { title: "Jadwal pemilihan" };
export const dynamic = "force-dynamic";

export default async function JadwalPublik() {
  const loaded = await loadPublicElections();
  const list = loaded ?? [];
  const label = (e: (typeof list)[number]) => e.rt ?? "Penjaringan RW 09";
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/" className="text-sm underline">← Beranda</Link>
      <h1 className="mb-1 mt-3 text-3xl font-extrabold">Jadwal pemilihan</h1>
      <p className="mb-6 text-muted-foreground">Pemilihan tiap RT dilaksanakan pada waktu yang berbeda. Jadwal yang belum tampil berarti belum ditetapkan panitia.</p>
      {loaded === null ? <p role="alert" className="rounded-lg border border-danger bg-danger-soft p-4 text-sm text-danger">Data belum dapat dimuat saat ini. Silakan muat ulang halaman beberapa saat lagi, atau hubungi panitia.</p> : list.length === 0 ? <p className="rounded-lg border bg-card p-6 text-center text-muted-foreground">Belum ada jadwal yang diumumkan.</p> : (
        <div className="space-y-6">
          <ScheduleCalendar events={list.filter((e) => e.mulai).map((e) => ({ date: e.mulai!, label: label(e), status: e.status }))} />
          <ul className="space-y-3">
            {list.map((e) => (
              <li key={e.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{label(e)}</h2><ElectionStatusBadge status={e.status} /></div>
                <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  <div><dt className="inline text-muted-foreground">Tanggal: </dt><dd className="inline">{fmtDate(e.mulai)}</dd></div>
                  <div><dt className="inline text-muted-foreground">Waktu: </dt><dd className="inline">{e.mulai ? `${fmtTime(e.mulai)}${e.selesai ? ` – ${fmtTime(e.selesai)}` : ""}` : "-"}</dd></div>
                  <div><dt className="inline text-muted-foreground">Lokasi: </dt><dd className="inline">{e.lokasi ?? "-"}</dd></div>
                  <div><dt className="inline text-muted-foreground">Metode: </dt><dd className="inline">{e.method === "VOTING" ? "Pemilihan dengan suara" : e.method === "MUSYAWARAH" ? "Musyawarah warga" : "-"}</dd></div>
                </dl>
                {e.status === "PEMILIHAN_BERLANGSUNG" && e.rt && <Link href={`/pilih/${e.rt.replace(" ", "").toLowerCase()}`} className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Mulai pemilihan {e.rt}</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
