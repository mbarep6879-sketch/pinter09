import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { PrintButton } from "@/components/admin/PrintButton";
import { fmtDate, fmtTime } from "@/lib/format";
import { hasTie } from "@/lib/stats";

type Snap = {
  election: { nama: string; type: string; rt: string | null; method: string; status: string };
  jadwal: { mulai: string | null; selesai: string | null; lokasi: string | null; penanggung_jawab: string | null };
  counts: { hak_suara: number; suara_masuk: number; online: number; manual: number; suara_sah: number; suara_tidak_sah: number; partisipasi_persen: number };
  hasil: { nomor_urut: number; nama: string; suara: number }[];
  musyawarah: { peserta: number; hasil: string; pengurus: { nama: string; jabatan: string }[]; catatan: string; tanggal: string } | null;
  meta: Record<string, string>;
};

export default async function CetakBA({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("berita-acara");
  const { id } = await params;
  const sb = await createServerSupabase();
  const { data: b } = await sb.from("berita_acara").select("nomor_dokumen, locked_at, snapshot").eq("election_id", id).maybeSingle();
  if (!b) notFound();
  const s = b.snapshot as Snap, c = s.counts, rt = s.election.rt ?? "";
  const judul = s.election.type === "RT" ? `PELAKSANAAN PEMILIHAN PENGURUS ${rt}` : "PELAKSANAAN PENJARINGAN BAKAL CALON PENGURUS RW 09";
  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{b.locked_at ? "Dokumen final." : "DRAF: belum difinalisasi."}</p><PrintButton />
      </div>
      <article className="space-y-5 rounded-lg border bg-white p-8 text-black print:border-0 print:p-0">
        {!b.locked_at && <p className="text-center text-sm font-bold text-red-700 print:text-black">— DRAF —</p>}
        <header className="text-center">
          <h1 className="text-xl font-bold">BERITA ACARA</h1>
          <h2 className="font-bold">{judul}</h2>
          <h2 className="font-bold">RW 09 KELURAHAN PURWANTORO</h2>
          <p className="mt-1 text-sm">Nomor: {b.nomor_dokumen ?? "........................................"}</p>
        </header>
        <hr />
        <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
          <dt>Hari/Tanggal</dt><dd>: {s.jadwal.mulai ? fmtDate(s.jadwal.mulai) : "........................"}</dd>
          <dt>Waktu</dt><dd>: {s.jadwal.mulai ? `${fmtTime(s.jadwal.mulai)}${s.jadwal.selesai ? ` s.d. ${fmtTime(s.jadwal.selesai)}` : ""}` : "........................"}</dd>
          <dt>Tempat</dt><dd>: {s.meta.tempat || s.jadwal.lokasi || "........................"}</dd>
          <dt>Metode</dt><dd>: {s.election.method === "MUSYAWARAH" ? "Musyawarah warga" : "Pemilihan dengan suara"}</dd>
        </dl>

        {s.election.method === "MUSYAWARAH" && s.musyawarah ? (
          <section className="text-sm">
            <p>Jumlah peserta musyawarah: <b>{s.musyawarah.peserta}</b> orang.</p>
            {s.musyawarah.hasil && <p className="mt-2">Hasil/kesepakatan: {s.musyawarah.hasil}</p>}
            <h3 className="mb-1 mt-3 font-bold">PENGURUS TERPILIH</h3>
            <ol className="list-decimal pl-6">{s.musyawarah.pengurus.map((p, i) => <li key={i}>{p.nama} — {p.jabatan}</li>)}</ol>
          </section>
        ) : (
          <>
            <dl className="grid grid-cols-[14rem_1fr] gap-y-1 text-sm">
              <dt>Jumlah hak suara</dt><dd>: {c.hak_suara}</dd><dt>Jumlah suara masuk</dt><dd>: {c.suara_masuk} (online {c.online}, manual {c.manual})</dd>
              <dt>Suara sah</dt><dd>: {c.suara_sah}</dd><dt>Suara tidak sah</dt><dd>: {c.suara_tidak_sah}</dd><dt>Partisipasi</dt><dd>: {c.partisipasi_persen}%</dd>
            </dl>
            <section>
              <h3 className="mb-1 font-bold">HASIL PEMILIHAN</h3>
              <ol className="list-decimal pl-6 text-sm">{s.hasil.map((h) => <li key={h.nomor_urut}>{h.nama} — {h.suara} suara</li>)}</ol>
              {hasTie(s.hasil.map((h) => ({ total_votes: h.suara }))) && <p className="mt-2 text-sm font-bold">Terdapat perolehan suara yang sama; penetapan dilakukan sesuai tata tertib yang berlaku.</p>}
            </section>
          </>
        )}
        {s.meta.catatan && <p className="text-sm">Catatan: {s.meta.catatan}</p>}
        <p className="text-sm">Demikian Berita Acara ini dibuat dengan sebenarnya.</p>
        <p className="text-right text-sm">{s.meta.tempat || "Purwantoro"}, {s.meta.tanggal ? fmtDate(s.meta.tanggal) : "........................"}</p>
        <div className="grid grid-cols-2 gap-8 pt-2 text-center text-sm">
          {[["Ketua Panitia", s.meta.ketua], ["Sekretaris", s.meta.sekretaris], ["Saksi 1", s.meta.saksi1], ["Saksi 2", s.meta.saksi2]].map(([r, n]) => (
            <div key={r}><p>{r}</p><div className="h-20" /><p className="font-bold underline">{n || "........................"}</p></div>
          ))}
        </div>
      </article>
    </div>
  );
}
