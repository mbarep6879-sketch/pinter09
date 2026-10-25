import { describe, expect, it } from "vitest";
import { humanizeError } from "../../src/lib/errors/messages";

describe("humanizeError", () => {
  it("kode voting", () => expect(humanizeError(new Error("ALREADY_VOTED"))).toBe("Hak suara Anda telah digunakan."));
  it("23505 menjadi pesan manusiawi", () => expect(humanizeError("PostgrestException 23505")).toBe("Data tersebut sudah terdaftar."));
  it("Unauthorized/RLS menjadi pesan kewenangan", () =>
    expect(humanizeError("permission denied for table x")).toBe("Anda tidak memiliki kewenangan untuk melakukan tindakan ini."));
  it("tidak membocorkan teks mentah", () => expect(humanizeError("boom 3573123456781234")).not.toContain("3573"));
  it("pilih nama dulu", () => expect(humanizeError(new Error("VOTER_NOT_SELECTED"))).toContain("pilih nama"));
});
