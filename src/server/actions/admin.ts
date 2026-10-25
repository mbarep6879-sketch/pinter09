"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccess, canWrite, ROLES, type Role, type Section } from "@/lib/auth/roles";
import { getStaff } from "@/lib/auth/session";
import { humanizeError } from "@/lib/errors/messages";

export type FormState = { ok?: boolean; error?: string; message?: string };
const FORBIDDEN = "Anda tidak memiliki kewenangan untuk melakukan tindakan ini.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lapisan 2 otorisasi: role diperiksa ulang di server pada setiap aksi (jangan percaya UI). */
async function run(section: Section, fn: (ctx: { sb: Awaited<ReturnType<typeof createServerSupabase>>; staffId: string; role: Role; fd: FormData }) => Promise<string | void>, fd: FormData, paths: string[] = []): Promise<FormState> {
  try {
    const staff = await getStaff();
    if (!staff || !canAccess(staff.role, section) || !canWrite(staff.role, section)) return { error: FORBIDDEN };
    const sb = await createServerSupabase();
    const message = await fn({ sb, staffId: staff.id, role: staff.role, fd });
    paths.forEach((p) => revalidatePath(p));
    return { ok: true, message: message || "Tersimpan." };
  } catch (e) {
    return { error: humanizeError(e) };
  }
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
function uuid(fd: FormData, k: string) { const v = str(fd, k); if (!UUID.test(v)) throw new Error("Data tidak valid."); return v; }
function check<T extends { error: { message: string } | null }>(r: T): T { if (r.error) throw new Error(r.error.message); return r; }
/** Input datetime-local diasumsikan WIB (UTC+7). */
const wib = (v: string) => (v ? new Date(`${v}:00+07:00`).toISOString() : null);

export async function setStatusAction(_: FormState, fd: FormData) {
  return run("pemilihan", async ({ sb }) => { check(await sb.rpc("set_election_status", { p_election: uuid(fd, "election_id"), p_to: str(fd, "to") })); return "Status diperbarui."; }, fd, ["/admin", "/admin/pemilihan"]);
}

export async function saveElectionConfigAction(_: FormState, fd: FormData) {
  return run("pemilihan", async ({ sb }) => {
    const method = str(fd, "method") || null;
    if (method && !["VOTING", "MUSYAWARAH"].includes(method)) throw new Error("Data tidak valid.");
    const raw = str(fd, "max_choices");
    const max = raw === "" ? null : Number(raw);
    if (max !== null && (!Number.isInteger(max) || max < 1 || max > 20)) throw new Error("Jumlah pilihan maksimal harus 1 sampai 20.");
    check(await sb.from("elections").update({ method, max_choices: max }).eq("id", uuid(fd, "election_id")));
    return "Konfigurasi tersimpan.";
  }, fd, ["/admin/pemilihan"]);
}

export async function saveScheduleAction(_: FormState, fd: FormData) {
  return run("jadwal", async ({ sb }) => {
    const mulai = wib(str(fd, "mulai")), selesai = wib(str(fd, "selesai"));
    if (mulai && selesai && selesai <= mulai) throw new Error("Waktu selesai harus setelah waktu mulai.");
    check(await sb.from("election_schedules").upsert({ election_id: uuid(fd, "election_id"), mulai, selesai, lokasi: str(fd, "lokasi") || null, penanggung_jawab: str(fd, "penanggung_jawab") || null, catatan: str(fd, "catatan") || null }));
  }, fd, ["/admin/jadwal", "/jadwal"]);
}

export async function addCandidateAction(_: FormState, fd: FormData) {
  return run("calon", async ({ sb }) => { check(await sb.rpc("add_candidate", { p_election: uuid(fd, "election_id"), p_voter: uuid(fd, "voter_id") })); return "Calon ditambahkan."; }, fd, ["/admin/calon"]);
}

export async function setCandidateStatusAction(_: FormState, fd: FormData) {
  return run("calon", async ({ sb }) => {
    const st = str(fd, "status");
    if (!["BAKAL_CALON", "CALON_TETAP", "MENGUNDURKAN_DIRI", "TIDAK_AKTIF", "TERPILIH"].includes(st)) throw new Error("Data tidak valid.");
    check(await sb.from("candidates").update({ status: st }).eq("id", uuid(fd, "candidate_id")));
  }, fd, ["/admin/calon"]);
}

export async function removeCandidateAction(_: FormState, fd: FormData) {
  return run("calon", async ({ sb }) => { check(await sb.from("candidates").delete().eq("id", uuid(fd, "candidate_id"))); return "Calon dihapus."; }, fd, ["/admin/calon"]);
}

export async function manualParticipationAction(_: FormState, fd: FormData) {
  return run("manual", async ({ sb }) => { check(await sb.rpc("record_manual_participation", { p_voter_id: uuid(fd, "voter_id"), p_election_id: uuid(fd, "election_id") })); return "Warga ditandai sudah memilih (manual)."; }, fd, ["/admin/manual", "/admin"]);
}

export async function manualTallyAction(_: FormState, fd: FormData) {
  return run("manual", async ({ sb }) => {
    const entries: { candidate_id: string; votes: number }[] = [];
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("votes_")) continue;
      const id = k.slice(6); const n = Number(v || 0);
      if (!UUID.test(id) || !Number.isInteger(n) || n < 0) throw new Error("Jumlah suara harus bilangan bulat 0 atau lebih.");
      entries.push({ candidate_id: id, votes: n });
    }
    const ballots = Number(str(fd, "ballot_count")), invalid = Number(str(fd, "invalid_count") || 0);
    if (!Number.isInteger(ballots) || ballots < 1 || !Number.isInteger(invalid) || invalid < 0) throw new Error("Jumlah kertas suara tidak valid.");
    const src = str(fd, "source_rt");
    check(await sb.rpc("enter_manual_tally", { p_election_id: uuid(fd, "election_id"), p_label: str(fd, "label").slice(0, 80) || "Batch", p_ballot_count: ballots, p_invalid: invalid, p_entries: entries, p_source_rt: src && UUID.test(src) ? src : null }));
    return "Rekap kertas suara tersimpan. Rekap tidak dapat diubah; gunakan permohonan koreksi bila salah.";
  }, fd, ["/admin/manual", "/admin/hasil"]);
}

export async function saveMusyawarahAction(_: FormState, fd: FormData) {
  return run("pemilihan", async ({ sb }) => {
    const pengurus = str(fd, "pengurus").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [nama, ...j] = l.split(" - "); return { nama: nama.trim(), jabatan: j.join(" - ").trim() }; });
    const peserta = Number(str(fd, "peserta"));
    if (!Number.isInteger(peserta) || peserta < 0) throw new Error("Jumlah peserta tidak valid.");
    if (pengurus.length === 0) throw new Error("Isi minimal satu pengurus terpilih (format: Nama - Jabatan).");
    check(await sb.rpc("save_musyawarah", { p_election: uuid(fd, "election_id"), p_data: { peserta, hasil: str(fd, "hasil"), pengurus, catatan: str(fd, "catatan"), tanggal: str(fd, "tanggal") } }));
  }, fd, ["/admin/pemilihan"]);
}

export async function saveBeritaAcaraAction(_: FormState, fd: FormData) {
  return run("berita-acara", async ({ sb }) => {
    const meta = Object.fromEntries(["ketua", "sekretaris", "saksi1", "saksi2", "tempat", "tanggal", "catatan"].map((k) => [k, str(fd, k)]));
    const fin = str(fd, "finalize") === "1";
    check(await sb.rpc("save_berita_acara", { p_election: uuid(fd, "election_id"), p_meta: meta, p_finalize: fin }));
    return fin ? "Berita Acara difinalisasi dan dikunci." : "Draf Berita Acara tersimpan.";
  }, fd, ["/admin/berita-acara"]);
}

export async function createStaffAction(_: FormState, fd: FormData) {
  return run("pengguna", async ({ staffId }) => {
    const email = str(fd, "email").toLowerCase(), nama = str(fd, "nama"), role = str(fd, "role") as Role, password = String(fd.get("password") ?? "");
    const rt = str(fd, "neighborhood_id");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !nama) throw new Error("Email dan nama wajib diisi dengan benar.");
    if (!ROLES.includes(role)) throw new Error("Role tidak valid.");
    if (password.length < 10) throw new Error("Kata sandi minimal 10 karakter.");
    if (["KOORDINATOR_RT"].includes(role) && !UUID.test(rt)) throw new Error("Koordinator RT harus ditugaskan ke satu RT.");
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(error?.message?.includes("already") ? "Email tersebut sudah terdaftar." : "Gagal membuat akun.");
    const ins = await admin.from("profiles").insert({ id: data.user.id, nama, role, neighborhood_id: UUID.test(rt) ? rt : null });
    if (ins.error) { await admin.auth.admin.deleteUser(data.user.id); throw new Error(ins.error.message); }
    await admin.rpc("log_security_event", { p_action: "STAFF_CREATED", p_actor: staffId, p_detail: { email, role } });
    return "Akun dibuat. Sampaikan kata sandi sementara secara langsung dan minta penggantian setelah masuk.";
  }, fd, ["/admin/pengguna"]);
}

export async function setStaffActiveAction(_: FormState, fd: FormData) {
  return run("pengguna", async ({ sb, staffId }) => {
    const id = uuid(fd, "id");
    if (id === staffId) throw new Error("Anda tidak dapat menonaktifkan akun Anda sendiri.");
    check(await sb.from("profiles").update({ is_active: str(fd, "active") === "1" }).eq("id", id));
  }, fd, ["/admin/pengguna"]);
}

const SETTING_KEYS = ["rule.second_factor", "doc.nomor_format", "rule.rw_selection_method", "rule.tie_break", "rule.invalid_vote_policy", "rule.rw_top_n_from_rt"];
export async function saveSettingAction(_: FormState, fd: FormData) {
  return run("pengaturan", async ({ sb }) => {
    const key = str(fd, "key"), raw = str(fd, "value");
    if (!SETTING_KEYS.includes(key)) throw new Error("Data tidak valid.");
    const value = raw === "" || raw === "NONE" ? null : raw;
    check(await sb.rpc("save_setting", { p_key: key, p_value: value }));
  }, fd, ["/admin/pengaturan"]);
}
