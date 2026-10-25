"use server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { RT_LIST } from "@/lib/constants";
import { normalizeKk } from "@/lib/kk/mask";
import { hmacInvite, hmacKey, hmacKk, normalizeInvite } from "@/lib/kk/hash";
import { ballotOptions, chooseVoter, rtIdByCode, startSession, submitBallots, type BallotInput, type BallotOptions, type Identity, type Member } from "@/server/services/voting";

export type Act<T> = { ok: true; data: T } | { ok: false; message: string; code?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;
const BUSY = "Terlalu banyak percobaan. Silakan tunggu beberapa menit lalu coba lagi.";
const NUM = (name: string, d: number) => Number(process.env[name]) || d;

async function ipOf(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Fail-closed: bila pemeriksaan batas gagal, permintaan ditolak. */
async function allowed(admin: ReturnType<typeof createAdminClient>, key: string, max: number, windowStr: string) {
  const { data, error } = await admin.rpc("check_rate_limit", { p_key: key, p_max: max, p_window: windowStr });
  return !error && data === true;
}

async function turnstileOk(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // belum diaktifkan panitia (lihat checklist go-live)
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch { return false; }
}

export async function verifyKkAction(input: { rt: string; kk: string; invite?: string; turnstile?: string }): Promise<Act<{ token: string; members: Member[] }>> {
  try {
    if (!(RT_LIST as readonly string[]).includes(input.rt)) return { ok: false, message: "RT tidak dikenal." };
    const kk = normalizeKk(String(input.kk ?? ""));
    if (!kk) return { ok: false, message: "Nomor KK harus 16 digit angka." };
    const invite = input.invite ? normalizeInvite(String(input.invite).slice(0, 24)) : "";
    const admin = createAdminClient();
    const ip = await ipOf();
    if (!(await allowed(admin, hmacKey("verify-ip", ip), NUM("RATE_LIMIT_VERIFY_MAX", 30), "10 minutes"))) return { ok: false, message: BUSY, code: "RATE_LIMIT" };
    const kkHash = hmacKk(kk);
    if (!(await allowed(admin, hmacKey("verify-kk", kkHash), 10, "10 minutes"))) return { ok: false, message: BUSY, code: "RATE_LIMIT" };
    if (!(await turnstileOk(input.turnstile, ip))) return { ok: false, message: "Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi." };

    const rtId = await rtIdByCode(admin, input.rt);
    if (!rtId) return { ok: false, message: "RT tidak dikenal." };
    const r = await startSession(admin, { rtId, kkHash, inviteHash: invite ? hmacInvite(invite) : null });
    return r.ok ? { ok: true, data: { token: r.data.token, members: r.data.members } } : { ok: false, message: r.message, code: r.code };
  } catch {
    return { ok: false, message: "Terjadi kendala. Silakan coba lagi atau hubungi panitia." };
  }
}

export async function selectVoterAction(input: { token: string; voterId: string }): Promise<Act<Identity>> {
  if (!TOKEN.test(input.token) || !UUID.test(input.voterId)) return { ok: false, message: "Sesi pemilihan tidak valid. Silakan mulai kembali.", code: "SESSION_INVALID" };
  try {
    const r = await chooseVoter(createAdminClient(), input.token, input.voterId);
    return r.ok ? { ok: true, data: r.data } : { ok: false, message: r.message, code: r.code };
  } catch { return { ok: false, message: "Terjadi kendala. Silakan coba lagi." }; }
}

export async function ballotAction(input: { token: string }): Promise<Act<BallotOptions>> {
  if (!TOKEN.test(input.token)) return { ok: false, message: "Sesi pemilihan tidak valid. Silakan mulai kembali.", code: "SESSION_INVALID" };
  try {
    const r = await ballotOptions(createAdminClient(), input.token);
    return r.ok ? { ok: true, data: r.data } : { ok: false, message: r.message, code: r.code };
  } catch { return { ok: false, message: "Terjadi kendala. Silakan coba lagi." }; }
}

export async function submitVoteAction(input: { token: string; ballots: BallotInput[] }): Promise<Act<{ receipt: string }>> {
  const ballots = Array.isArray(input.ballots) ? input.ballots : [];
  const shapeOk = ballots.length > 0 && ballots.length <= 2 && ballots.every((b) => UUID.test(b.election_id) && Array.isArray(b.candidate_ids) && b.candidate_ids.length > 0 && b.candidate_ids.length <= 20 && b.candidate_ids.every((c) => UUID.test(c)));
  if (!TOKEN.test(input.token) || !shapeOk) return { ok: false, message: "Data pilihan tidak valid. Silakan mulai kembali.", code: "SESSION_INVALID" };
  try {
    const r = await submitBallots(createAdminClient(), input.token, ballots);
    return r.ok ? { ok: true, data: r.data } : { ok: false, message: r.message, code: r.code };
  } catch { return { ok: false, message: "Terjadi kendala. Pilihan Anda belum tercatat; silakan coba lagi atau hubungi panitia." }; }
}
