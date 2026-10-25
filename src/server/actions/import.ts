"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/auth/roles";
import { getStaff } from "@/lib/auth/session";
import { commitImport, discardImport, previewImport, type ImportPreview } from "@/server/services/importer";

export type ImportState = { error?: string; preview?: ImportPreview; done?: { households_added: number; voters_added: number }; discarded?: boolean };
const FORBIDDEN = "Anda tidak memiliki kewenangan untuk melakukan tindakan ini.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authorize() { const s = await getStaff(); return s && canAccess(s.role, "import") ? s : null; }

export async function previewImportAction(_: ImportState, fd: FormData): Promise<ImportState> {
  const staff = await authorize(); if (!staff) return { error: FORBIDDEN };
  const f = fd.get("file");
  if (!(f instanceof File) || f.size === 0) return { error: "Pilih berkas .xlsx atau .csv terlebih dahulu." };
  try {
    const r = await previewImport(createAdminClient(), staff.id, { name: f.name, buffer: Buffer.from(await f.arrayBuffer()) });
    return r.ok ? { preview: r.data } : { error: r.message };
  } catch { return { error: "Terjadi kendala saat memproses berkas. Coba lagi atau hubungi Super Admin." }; }
}

export async function commitImportAction(_: ImportState, fd: FormData): Promise<ImportState> {
  const staff = await authorize(); if (!staff) return { error: FORBIDDEN };
  const id = String(fd.get("batch_id") ?? "");
  if (!UUID.test(id)) return { error: "Data tidak valid." };
  const r = await commitImport(createAdminClient(), staff.id, id, fd.get("allow_partial") === "1");
  if (!r.ok) return { error: r.message };
  revalidatePath("/admin"); revalidatePath("/admin/pemilih");
  return { done: r.data };
}

export async function discardImportAction(_: ImportState, fd: FormData): Promise<ImportState> {
  const staff = await authorize(); if (!staff) return { error: FORBIDDEN };
  const id = String(fd.get("batch_id") ?? "");
  if (!UUID.test(id)) return { error: "Data tidak valid." };
  const r = await discardImport(createAdminClient(), staff.id, id);
  return r.ok ? { discarded: true } : { error: r.message };
}
