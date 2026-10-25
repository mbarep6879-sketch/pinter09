import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { canAccess, type Role, type Section } from "@/lib/auth/roles";

export type Staff = { id: string; nama: string; role: Role; neighborhoodId: string | null; email: string | null };

/** Pengguna login + profil aktif, atau null. getUser() memvalidasi token ke server Auth (bukan sekadar membaca cookie). */
export async function getStaff(): Promise<Staff | null> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: p } = await supabase.from("profiles").select("nama, role, neighborhood_id, is_active").eq("id", auth.user.id).maybeSingle();
  if (!p || !p.is_active) return null;
  return { id: auth.user.id, nama: p.nama, role: p.role as Role, neighborhoodId: p.neighborhood_id, email: auth.user.email ?? null };
}

export async function requireStaff(section: Section): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  if (!canAccess(staff.role, section)) redirect("/admin?akses=ditolak");
  return staff;
}
