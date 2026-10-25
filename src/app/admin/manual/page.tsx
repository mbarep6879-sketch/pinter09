import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { loadElections, pickElection } from "@/lib/elections";
import { PageHeader } from "@/components/admin/PageHeader";
import { ElectionTabs } from "@/components/admin/ElectionTabs";
import { ActionForm } from "@/components/admin/ActionForm";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { manualParticipationAction, manualTallyAction } from "@/server/actions/admin";
import type { VoterRow } from "@/server/actions/search";

export default async function Manual({ searchParams }: { searchParams: Promise<{ e?: string; q?: string }> }) {
  await requireStaff("manual");
  const sp = await searchParams;
  const sb = await createServerSupabase();
  const all = await loadElections(sb);
  const el = pickElection(all, sp.e);
  if (!el) return <Alert kind="warning">Belum ada pemilihan.</Alert>;
  const votingOpen = el.status === "PEMILIHAN_BERLANGSUNG", tallyOpen = votingOpen || el.status === "PERHITUNGAN";
  const q = sp.q?.trim().slice(0, 60);
  const [{ data: rec }, { data: found }, { data: cs }, { data: nb }] = await Promise.all([
    sb.rpc("manual_reconciliation", { p_election_id: el.id }),
    q ? sb.rpc("list_voters", { p_rt: el.neighborhood_id, p_q: q, p_limit: 15, p_offset: 0 }) : Promise.resolve({ data: [] }),
    sb.from("candidates").select("id, nomor_urut, status, voters(nama)").eq("election_id", el.id).in("status", ["BAKAL_CALON", "CALON_TETAP"]).order("nomor_urut"),
    sb.from("neighborhoods").select("id, code").order("code"),
  ]);
  const cands = (cs ?? []) as unknown as { id: string; nomor_urut: number; voters: { nama: string } | null }[];
  const people = ((found ?? []) as VoterRow[]).filter((v) => v.has_voting_right);

  return (
    <div className="space-y-6">
      <PageHeader title="Suara manual" subtitle="Untuk warga yang memilih dengan kertas suara. Dua langkah: tandai warga yang sudah memilih, lalu masukkan rekap hitungan kertas suara." />
      <ElectionTabs list={all} current={el.id} base="/admin/manual" />
      {!tallyOpen && <Alert kind="info">Input manual hanya dapat dilakukan saat status “Pemilihan berlangsung” atau “Perhitungan” (status saat ini: {el.status}).</Alert>}

      <Card>
        <h2 className="mb-2 font-bold">Rekonsiliasi</h2>
        {rec ? (
          <>
            <p className="text-sm">Warga ditandai memilih manual: <b>{rec.manual_participants}</b> · Kertas suara yang sudah direkap: <b>{rec.manual_ballots_counted}</b></p>
            <div className="mt-2"><Alert kind={rec.balanced ? "success" : "warning"}>{rec.balanced ? "Seimbang: jumlah peserta manual sama dengan jumlah kertas suara." : `Belum seimbang (selisih ${rec.difference}). Pemilihan tidak dapat diselesaikan sebelum seimbang.`}</Alert></div>
          </>
        ) : <p className="text-sm text-muted-foreground">Tidak tersedia.</p>}
      </Card>

      <Card>
        <h2 className="mb-1 font-bold">1. Tandai warga yang memilih dengan kertas suara</h2>
        <p className="mb-3 text-sm text-muted-foreground">Pencatatan ini hanya menandai bahwa hak suara sudah digunakan; pilihannya tidak dicatat di sini.</p>
        <form method="get" className="mb-3 flex gap-2"><input type="hidden" name="e" value={el.id} /><Input name="q" defaultValue={q ?? ""} placeholder="Cari nama warga" className="max-w-sm" /><Button type="submit">Cari</Button></form>
        <ul className="divide-y">
          {people.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span><b>{v.nama}</b> · {v.rt} · {v.alamat} · KK {v.kk_masked}</span>
              {v.sudah_memilih ? <span className="font-semibold text-success">Sudah memilih ({v.channel === "MANUAL" ? "manual" : "online"})</span> :
                <ActionForm action={manualParticipationAction} submit="Tandai sudah memilih" size="sm" confirm={`Tandai ${v.nama} sudah memilih? Tindakan ini tidak dapat dibatalkan.`} silent><input type="hidden" name="voter_id" value={v.id} /><input type="hidden" name="election_id" value={el.id} /></ActionForm>}
            </li>
          ))}
          {q && people.length === 0 && <li className="py-2 text-sm text-muted-foreground">Tidak ada warga berhak yang cocok.</li>}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-1 font-bold">2. Rekap hitungan kertas suara</h2>
        <p className="mb-3 text-sm text-muted-foreground">Masukkan hasil hitung per batch. Rekap tidak dapat diubah atau dihapus; bila salah, ajukan koreksi.</p>
        {tallyOpen && cands.length > 0 ? (
          <ActionForm action={manualTallyAction} submit="Simpan rekap" confirm="Simpan rekap? Rekap tidak dapat diubah setelah disimpan." className="space-y-3">
            <input type="hidden" name="election_id" value={el.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Label batch"><Input name="label" defaultValue="Batch 1" required /></Field>
              <Field label="Jumlah kertas suara"><Input type="number" name="ballot_count" min={1} required /></Field>
              <Field label="Di antaranya tidak sah"><Input type="number" name="invalid_count" min={0} defaultValue={0} /></Field>
            </div>
            {el.type !== "RT" && <Field label="RT asal kertas suara" hint="Diperlukan untuk rekap per RT."><Select name="source_rt" required><option value="">— pilih RT —</option>{nb?.map((n) => <option key={n.id} value={n.id}>{n.code}</option>)}</Select></Field>}
            <div className="grid gap-3 sm:grid-cols-2">
              {cands.map((c) => <Field key={c.id} label={`${String(c.nomor_urut).padStart(2, "0")}. ${c.voters?.nama ?? ""}`}><Input type="number" name={`votes_${c.id}`} min={0} defaultValue={0} /></Field>)}
            </div>
          </ActionForm>
        ) : <p className="text-sm text-muted-foreground">{cands.length === 0 ? "Belum ada calon." : "Menunggu status pemilihan yang sesuai."}</p>}
      </Card>
    </div>
  );
}
