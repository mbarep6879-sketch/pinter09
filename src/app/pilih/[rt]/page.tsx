import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { RT_LIST, STATUS_LABEL, type ElectionStatus } from "@/lib/constants";
import { createAnonClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { VotingFlow } from "@/components/voting/VotingFlow";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Pemilihan" };
export const dynamic = "force-dynamic";

function fmt(d?: string | null) {
  return d ? new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(d)) : null;
}

export default async function PilihRT({ params }: { params: Promise<{ rt: string }> }) {
  const { rt } = await params;
  const label = RT_LIST.find((r) => r.replace(" ", "").toLowerCase() === rt);
  if (!label) notFound();

  let status: ElectionStatus | null = null;
  let loadFailed = !isSupabaseConfigured();
  let sched: { mulai: string | null; selesai: string | null; lokasi: string | null } | null = null;
  if (isSupabaseConfigured()) {
    const sb = createAnonClient();
    const { data: n, error: e1 } = await sb.from("neighborhoods").select("id").eq("code", label).maybeSingle();
    const { data: e, error: e2 } = n ? await sb.from("elections").select("id, status").eq("neighborhood_id", n.id).maybeSingle() : { data: null, error: null };
    if (e1 || e2 || !n) loadFailed = true;
    status = (e?.status as ElectionStatus) ?? null;
    if (e) { const { data: s } = await sb.from("election_schedules").select("mulai, selesai, lokasi").eq("election_id", e.id).maybeSingle(); sched = s; }
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-8">
      <p className="text-sm font-semibold text-primary">Pemilihan Pengurus {label} · RW 09</p>
      <h1 className="mb-6 text-2xl font-extrabold">Pemilihan Pengurus {label}</h1>
      {loadFailed ? (
        <Alert kind="error"><p className="font-semibold">Status pemilihan belum dapat dimuat.</p><p>Silakan muat ulang halaman beberapa saat lagi. Jika terus terjadi, hubungi panitia.</p></Alert>
      ) : status === "PEMILIHAN_BERLANGSUNG" ? (
        <VotingFlow rt={label} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined} />
      ) : (
        <div className="space-y-4">
          <Alert kind="info">
            <p className="font-semibold">{status ? `Pemilihan ${label} belum dibuka atau sudah ditutup (status: ${STATUS_LABEL[status]}).` : `Pemilihan ${label} belum dijadwalkan.`}</p>
            <p>Anda baru dapat memberikan suara saat status pemilihan berlangsung.</p>
          </Alert>
          {sched && (sched.mulai || sched.lokasi) && (
            <div className="flex gap-3 rounded-lg border bg-card p-4 text-sm">
              <CalendarClock className="size-5 shrink-0 text-primary" aria-hidden />
              <div>{fmt(sched.mulai) && <p>Mulai: {fmt(sched.mulai)}</p>}{fmt(sched.selesai) && <p>Selesai: {fmt(sched.selesai)}</p>}{sched.lokasi && <p>Lokasi: {sched.lokasi}</p>}</div>
            </div>
          )}
          <Link href="/jadwal" className="inline-block text-sm underline">Lihat jadwal lengkap</Link>
        </div>
      )}
    </main>
  );
}
