import Link from "next/link";
import { CalendarDays, Lock, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP } from "@/lib/constants";
import { ElectionTimeline } from "@/components/election/ElectionTimeline";
import { loadPublicElections } from "@/lib/public-data";
import { stepState } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function Home() {
  const loaded = await loadPublicElections();
  const list = loaded ?? [];
  const rts = ["RT 01", "RT 02", "RT 03", "RT 04", "RT 05", "RT 06"];
  const state = (rt: string) => { const e = list.find((x) => x.rt === rt); return e ? stepState(e.status) : "todo"; };
  const rw = list.find((x) => x.type === "RW_NOMINATION");
  const active = list.filter((e) => e.status === "PEMILIHAN_BERLANGSUNG" && e.rt);
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <span className="font-bold text-primary">PEMILIHAN WARGA RW {APP.rw}</span>
        <nav aria-label="Menu utama" className="flex items-center gap-4 text-sm font-medium">
          <Link href="/jadwal" className="hover:underline">Jadwal</Link>
          <Link href="/hasil" className="hover:underline">Hasil</Link>
          <Link href="/login" className="inline-flex items-center gap-1 hover:underline"><Lock className="size-3.5" aria-hidden /> Panitia</Link>
        </nav>
      </header>
      <main className="flex-1 py-10 sm:py-14">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Pemilihan Pengurus RT &amp; RW {APP.rw}</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">Kelurahan {APP.kelurahan}. Satu hak suara untuk setiap warga, pilihan Anda dirahasiakan, dan hasilnya bisa diperiksa bersama.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" variant={active.length ? "outline" : "default"}><Link href="/jadwal"><CalendarDays className="size-5" aria-hidden />Cek jadwal pemilihan</Link></Button>
          {active.length > 0 && <Button asChild size="lg"><Link href="/pilih"><Vote className="size-5" aria-hidden />Mulai pemilihan</Link></Button>}
        </div>
        {loaded === null && <p role="alert" className="mt-4 rounded-md bg-warning-soft p-3 text-sm text-warning">Status pemilihan belum dapat dimuat. Muat ulang halaman beberapa saat lagi.</p>}
        {active.length > 0 && <p className="mt-3 text-sm font-semibold text-success">Sedang berlangsung: {active.map((e) => e.rt).join(", ")}</p>}
        <section className="mt-14" aria-labelledby="tahapan">
          <h2 id="tahapan" className="mb-3 text-lg font-bold">Tahapan pemilihan</h2>
          <ElectionTimeline steps={[...rts.map((r) => ({ label: r, state: state(r) })), { label: "RW 09", state: rw ? stepState(rw.status) : "todo" }]} />
        </section>
      </main>
      <footer className="border-t py-6 text-sm text-muted-foreground">{APP.subtitle}. Panitia tidak menampilkan nomor KK atau pilihan individu kepada siapa pun.</footer>
    </div>
  );
}
