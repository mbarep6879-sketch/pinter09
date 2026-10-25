import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/roles";
import { XLSX_TYPE, fileResponse, toCsv, toXlsx } from "@/lib/export";

export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff || !canAccess(staff.role, "pemilih")) return new Response("Tidak berwenang", { status: 403 });
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const sb = await createServerSupabase();
  const rows: unknown[][] = [];
  for (let off = 0; off < 20000; off += 200) {
    const { data, error } = await sb.rpc("list_voters", { p_limit: 200, p_offset: off });
    if (error) return new Response("Gagal mengambil data", { status: 500 });
    if (!data?.length) break;
    for (const r of data) rows.push([r.rt, r.nama, r.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan", r.hubungan, r.alamat, r.kk_masked, r.has_voting_right ? "Berhak" : "Tidak berhak", r.sudah_memilih ? (r.channel === "MANUAL" ? "Sudah (manual)" : "Sudah (online)") : "Belum"]);
    if (data.length < 200) break;
  }
  const headers = ["RT", "Nama", "Jenis Kelamin", "Hubungan", "Alamat", "KK (tersamar)", "Hak Suara", "Status Memilih"];
  await createAdminClient().rpc("log_security_event", { p_action: "EXPORT_VOTERS", p_actor: staff.id, p_detail: { format, rows: rows.length } });
  return format === "csv" ? fileResponse(toCsv(headers, rows), "pemilih-rw09.csv", "text/csv; charset=utf-8") : fileResponse(new Uint8Array(await toXlsx("Pemilih", headers, rows)), "pemilih-rw09.xlsx", XLSX_TYPE);
}
