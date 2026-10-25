"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hmacKey } from "@/lib/kk/hash";

export type LoginState = { error?: string };

async function ipOf(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function signIn(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  if (!email || !password) return { error: "Email dan kata sandi wajib diisi." };

  const admin = createAdminClient();
  const key = hmacKey("login", `${await ipOf()}|${email}`);
  const { data: allowed } = await admin.rpc("check_rate_limit", { p_key: key, p_max: 8, p_window: "10 minutes" });
  if (allowed === false) return { error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Email atau kata sandi tidak sesuai." };

  const { data: p } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!p?.is_active) {
    await supabase.auth.signOut();
    return { error: "Akun Anda belum diaktifkan sebagai pengguna panitia. Hubungi Super Admin." };
  }
  await admin.rpc("log_security_event", { p_action: "LOGIN", p_actor: data.user.id, p_detail: {} });
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function signOut() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) await createAdminClient().rpc("log_security_event", { p_action: "LOGOUT", p_actor: data.user.id, p_detail: {} });
  await supabase.auth.signOut();
  redirect("/login");
}
