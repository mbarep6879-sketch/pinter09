import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { loadElections } from "@/lib/elections";
import { PageHeader } from "@/components/admin/PageHeader";
import { Alert } from "@/components/ui/alert";
import { totals, type Stats } from "@/lib/stats";

type Step = { n: number; title: string; done: boolean; detail: string; href: string };

export default async function Wizard() {
  await requireStaff("wizard");
  const sb = await createServerSupabase();
  const [els, { data: st }, { data: sch }, { data: cs }, { data: bas }, { data: setts }] = await Promise.all([
    loadElections(sb), sb.rpc("get_dashboard_stats"), sb.from("election_schedules").select("election_id, mulai"), sb.from("candidates").select("election_id, status"),
    sb.from("berita_acara").select("election_id, locked_at"), sb.from("settings").select("key, value"),
  ]);
  const stats = st as Stats | null; const t = totals(stats?.rt ?? []);
  const rt = els.filter((e) => e.type === "RT");
  const all = (f: (e: (typeof rt)[number]) => boolean) => rt.length > 0 && rt.every(f);
  const scheduled = new Set((sch ?? []).filter((s) => s.mulai).map((s) => s.election_id));
  const cnt = (id: string, status?: string) => (cs ?? []).filter((c) => c.election_id === id && (!status || c.status === status)).length;
  const closed = (e: (typeof rt)[number]) => e.status === "SELESAI" || e.status === "DITETAPKAN";
  const rtWith = (stats?.rt ?? []).filter((r) => r.berhak_l + r.berhak_p > 0).length;

  const steps: Step[] = [
    { n: 1, title: "Import pemilih", done: t.total > 0, detail: `${t.total} pemilih berhak, ${t.kk} KK`, href: "/admin/pemilih/import" },
    { n: 2, title: "Validasi data", done: rtWith === 6, detail: `${rtWith} dari 6 RT sudah punya pemilih berhak`, href: "/admin/pemilih" },
    { n: 3, title: "Buat jadwal", done: all((e) => scheduled.has(e.id)), detail: `${rt.filter((e) => scheduled.has(e.id)).length} dari 6 RT berjadwal`, href: "/admin/jadwal" },
    { n: 4, title: "Input calon", done: all((e) => cnt(e.id) > 0), detail: `${rt.filter((e) => cnt(e.id) > 0).length} dari 6 RT punya calon`, href: "/admin/calon" },
    { n: 5, title: "Verifikasi calon (calon tetap)", done: all((e) => cnt(e.id, "CALON_TETAP") > 0), detail: `${rt.filter((e) => cnt(e.id, "CALON_TETAP") > 0).length} dari 6 RT punya calon tetap`, href: "/admin/calon" },
    { n: 6, title: "Aktifkan pemilihan", done: rt.some((e) => e.status !== "DRAFT" && e.status !== "TERJADWAL" && e.status !== "PERSIAPAN"), detail: "Buka per RT sesuai jadwal", href: "/admin/pemilihan" },
    { n: 7, title: "Monitoring", done: t.voted > 0, detail: `${t.voted} suara masuk`, href: "/admin" },
    { n: 8, title: "Tutup pemilihan", done: rt.some(closed) || rt.some((e) => e.status === "PERHITUNGAN"), detail: `${rt.filter(closed).length} dari 6 RT selesai`, href: "/admin/pemilihan" },
    { n: 9, title: "Validasi hasil", done: all(closed), detail: "Periksa hasil dan rekonsiliasi suara manual", href: "/admin/hasil" },
    { n: 10, title: "Generate Berita Acara", done: rt.length > 0 && rt.every((e) => (bas ?? []).some((b) => b.election_id === e.id && b.locked_at)), detail: `${(bas ?? []).filter((b) => b.locked_at).length} dokumen final`, href: "/admin/berita-acara" },
  ];
  const pending = (setts ?? []).filter((s) => s.value === null).map((s) => s.key as string);
  const NAMES: Record<string, string> = { "rule.second_factor": "Faktor kedua verifikasi (kode undangan)", "rule.rw_selection_method": "Metode pemilihan/penjaringan RW", "rule.tie_break": "Aturan perolehan suara sama (tie-break)", "rule.invalid_vote_policy": "Kebijakan suara tidak sah / kosong", "rule.rw_top_n_from_rt": "Jumlah bakal calon RW dari tiap RT", "doc.nomor_format": "Format nomor Berita Acara" };

  return (
    <div className="space-y-6">
      <PageHeader title="Persiapan pemilihan" subtitle="Langkah-langkah dari data warga hingga Berita Acara. Status dihitung otomatis dari data." />
      <ol className="space-y-2">
        {steps.map((s) => (
          <li key={s.n}>
            <Link href={s.href} className="flex items-center gap-3 rounded-lg border bg-card p-4 hover:border-primary">
              {s.done ? <CheckCircle2 className="size-6 shrink-0 text-success" aria-hidden /> : <Circle className="size-6 shrink-0 text-muted-foreground" aria-hidden />}
              <span className="flex-1"><span className="block font-semibold">Langkah {s.n}: {s.title}</span><span className="block text-sm text-muted-foreground">{s.detail}</span></span>
              <span className="text-sm font-semibold">{s.done ? "Selesai" : "Belum"}</span>
            </Link>
          </li>
        ))}
      </ol>
      {pending.length > 0 && (
        <Alert kind="warning">
          <p className="font-semibold">Aturan yang masih menunggu keputusan panitia (tidak diisi otomatis oleh sistem):</p>
          <ul className="list-disc pl-5">{pending.map((k) => <li key={k}>{NAMES[k] ?? k}</li>)}</ul>
          <p>Super Admin dapat menetapkannya di menu Pengaturan.</p>
        </Alert>
      )}
    </div>
  );
}
