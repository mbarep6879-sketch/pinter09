import { describe, expect, it } from "vitest";
import { isValidKkFormat, maskKk, normalizeKk } from "../../src/lib/kk/mask";
import { formatPercent } from "../../src/lib/utils";

describe("Nomor KK", () => {
  it("menerima 16 digit", () => expect(isValidKkFormat("3573123456781234")).toBe(true));
  it("menolak panjang salah", () => {
    expect(isValidKkFormat("357312345678123")).toBe(false);
    expect(isValidKkFormat("35731234567812345")).toBe(false);
  });
  it("menolak non-angka", () => expect(isValidKkFormat("35731234567812AB")).toBe(false));
  it("membersihkan spasi dan tanda hubung hasil salin", () => {
    expect(normalizeKk("3573 1234 5678 1234")).toBe("3573123456781234");
    expect(normalizeKk("3573-1234-5678-1234")).toBe("3573123456781234");
  });
  it("menolak input tidak valid setelah dibersihkan", () => expect(normalizeKk("123 456")).toBeNull());
  it("menyamarkan nomor KK", () => expect(maskKk("3573123456781234")).toBe("3573********1234"));
  it("tidak membocorkan input tidak valid", () => expect(maskKk("123")).not.toContain("123"));
});

describe("persentase", () => {
  it("aman dari pembagian nol", () => expect(formatPercent(5, 0)).toBe("0%"));
  it("format Indonesia", () => expect(formatPercent(876, 1245)).toBe("70,36%"));
});
