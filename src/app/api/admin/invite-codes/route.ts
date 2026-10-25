import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/roles";
import { XLSX_TYPE, fileResponse, sameOrigin, toXlsx } from "@/lib/export";
import { generateInviteCode, hmacInvite } from "@/lib/kk/hash";

type H = { household_id: string; rt: string; kk_masked: string; alamat: string; anggota: string };

/** Membuat kode undangan baru lalu mengunduhnya SEKALI. Database hanya menyimpan hash-nya. */
export async function POST(req: Request) {
  const staff = await getStaff();
  if (!staff || !canAccess(staff.role, "undangan")) return new Response("Tidak berwenang", { status: 403 });
  if (!sameOrigin(req)) return new Response("Permintaan ditolak", { status: 403 });
  const fd = await req.formData();
  const rt = String(fd.get("rt") ?? ""), onlyMissing = fd.get("only_missing") !== "0";
  const sb = await createServerSupabase();
  const { data, error } = await sb.rpc("list_households_for_codes", { p_rt: /^[0-9a-f-]{36}$/i.test(rt) ? rt : null, p_only_missing: onlyMissing });
  if (error) return new Response("Gagal mengambil data", { status: 500 });
  const hh = (data ?? []) as H[];
  if (hh.length === 0) return new Response("Tidak ada KK yang perlu kode.", { status: 409 });

  const codes = hh.map((h) => ({ h, code: generateInviteCode() }));
  const { error: e2 } = await createAdminClient().rpc("set_invite_codes", { p_items: codes.map((c) => ({ household_id: c.h.household_id, hash: hmacInvite(c.code) })), p_actor: staff.id });
  if (e2) return new Response("Gagal menyimpan kode", { status: 500 });
  const xlsx = await toXlsx("Kode Undangan", ["RT", "Alamat", "Anggota berhak memilih", "KK (tersamar)", "Kode Undangan"], codes.map(({ h, code }) => [h.rt, h.alamat, h.anggota, h.kk_masked, code]));
  return fileResponse(new Uint8Array(xlsx), "kode-undangan.xlsx", XLSX_TYPE);
}
