import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/roles";
import { XLSX_TYPE, fileResponse, toCsv, toXlsx } from "@/lib/export";

export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff || !canAccess(staff.role, "hasil")) return new Response("Tidak berwenang", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const id = sp.get("e") ?? "", format = sp.get("format") === "csv" ? "csv" : "xlsx";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Permintaan tidak valid", { status: 400 });
  const sb = await createServerSupabase();
  const { data, error } = await sb.rpc("get_election_results", { p_election_id: id });
  if (error) return new Response("Tidak berwenang atau data tidak ditemukan", { status: 403 });
  const total = data.reduce((a: number, r: { total_votes: number }) => a + Number(r.total_votes), 0);
  const rows = data.map((r: { nomor_urut: number; nama: string; online_votes: number; manual_votes: number; total_votes: number }, i: number) =>
    [i + 1, r.nomor_urut, r.nama, Number(r.online_votes), Number(r.manual_votes), Number(r.total_votes), total ? Math.round((Number(r.total_votes) / total) * 10000) / 100 : 0]);
  const headers = ["Urutan tampilan", "No. Calon", "Nama", "Suara Online", "Suara Manual", "Total Suara", "Persen (%)"];
  await createAdminClient().rpc("log_security_event", { p_action: "EXPORT_RESULTS", p_actor: staff.id, p_detail: { election: id, format } });
  return format === "csv" ? fileResponse(toCsv(headers, rows), "hasil-pemilihan.csv", "text/csv; charset=utf-8") : fileResponse(new Uint8Array(await toXlsx("Hasil", headers, rows)), "hasil-pemilihan.xlsx", XLSX_TYPE);
}
