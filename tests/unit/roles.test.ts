import { describe, expect, it } from "vitest";
import { ROLES, canAccess, canWrite, type Section } from "../../src/lib/auth/roles";
import { generateInviteCode, hmacInvite, hmacKk, normalizeInvite } from "../../src/lib/kk/hash";

const K = "x".repeat(40);

describe("akses halaman per role", () => {
  it("VIEWER hanya dashboard", () => {
    const allowed = (["dashboard","pemilih","import","jadwal","calon","pemilihan","manual","hasil","berita-acara","audit","wizard","pengguna","pengaturan"] as Section[]).filter((s) => canAccess("VIEWER", s));
    expect(allowed).toEqual(["dashboard"]);
  });
  it("hanya SUPER_ADMIN yang membuka pengguna dan pengaturan", () => {
    for (const r of ROLES) {
      expect(canAccess(r, "pengguna")).toBe(r === "SUPER_ADMIN");
      expect(canAccess(r, "pengaturan")).toBe(r === "SUPER_ADMIN");
    }
  });
  it("OPERATOR boleh input manual tetapi tidak import", () => {
    expect(canAccess("OPERATOR", "manual")).toBe(true);
    expect(canAccess("OPERATOR", "import")).toBe(false);
  });
  it("koordinator hanya melihat, tidak mengubah", () => {
    expect(canWrite("KOORDINATOR_RW", "calon")).toBe(false);
    expect(canWrite("PANITIA", "calon")).toBe(true);
  });
  it("tanpa role = tanpa akses", () => expect(canAccess(null, "dashboard")).toBe(false));
});

describe("hash & kode undangan", () => {
  it("HMAC KK deterministik dan bergantung pada rahasia", () => {
    expect(hmacKk("3573123456781234", K)).toBe(hmacKk("3573123456781234", K));
    expect(hmacKk("3573123456781234", K)).not.toBe(hmacKk("3573123456781234", "y".repeat(40)));
    expect(hmacKk("3573123456781234", K)).not.toContain("3573");
  });
  it("kode undangan berformat XXXX-XXXX tanpa karakter ambigu", () => {
    for (let i = 0; i < 200; i++) expect(generateInviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });
  it("kode undangan tahan salah ketik huruf besar/kecil, spasi, tanda hubung", () => {
    expect(hmacInvite("abcd-efgh", K)).toBe(hmacInvite("ABCD EFGH", K));
    expect(normalizeInvite("ab-cd")).toBe("ABCD");
  });
  it("kode undangan acak (tidak berulang pada 500 percobaan)", () => {
    expect(new Set(Array.from({ length: 500 }, generateInviteCode)).size).toBe(500);
  });
});
