import { PageHeader } from "@/components/admin/PageHeader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";

export default async function Undangan() {
  await requireStaff("undangan");
  const sb = await createServerSupabase();
  const [{ data: nb }, { data: s }, { data: missing }] = await Promise.all([
    sb.from("neighborhoods").select("id, code").order("code"),
    sb.from("settings").select("value").eq("key", "rule.second_factor").maybeSingle(),
    sb.rpc("list_households_for_codes", { p_only_missing: true }),
  ]);
  const active = s?.value === "INVITE_CODE";
  const perRt = new Map<string, number>(); (missing ?? []).forEach((h: { rt: string }) => perRt.set(h.rt, (perRt.get(h.rt) ?? 0) + 1));
  return (
    <div className="space-y-5">
      <PageHeader title="Kode undangan" subtitle="Faktor kedua verifikasi: warga memasukkan Nomor KK dan kode dari panitia." />
      <Alert kind={active ? "success" : "warning"}>{active ? "Faktor kedua AKTIF: pemilih wajib memasukkan kode undangan." : "Faktor kedua belum aktif. Siapa pun yang mengetahui Nomor KK dapat memilih atas nama suami/istri dalam KK tersebut. Aktifkan di menu Pengaturan setelah kode dibagikan."}</Alert>
      <Alert kind="info"><p>Kode hanya muncul <b>satu kali</b> di berkas Excel yang diunduh (database menyimpan hash-nya). Berkas memuat RT, alamat, dan nama anggota agar mudah dibagikan. Jaga kerahasiaan berkas ini dan hapus setelah selesai dibagikan.</p></Alert>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {nb?.map((n) => (
          <Card key={n.id}>
            <h2 className="font-bold">{n.code}</h2>
            <p className="mb-3 text-sm text-muted-foreground">{perRt.get(n.code) ?? 0} KK belum punya kode</p>
            <form method="post" action="/api/admin/invite-codes">
              <input type="hidden" name="rt" value={n.id} />
              <Button type="submit" disabled={!perRt.get(n.code)} className="w-full">Buat &amp; unduh kode</Button>
            </form>
            <form method="post" action="/api/admin/invite-codes" className="mt-2">
              <input type="hidden" name="rt" value={n.id} /><input type="hidden" name="only_missing" value="0" />
              <Button type="submit" variant="outline" size="sm" className="w-full">Buat ulang semua (kode lama hangus)</Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
