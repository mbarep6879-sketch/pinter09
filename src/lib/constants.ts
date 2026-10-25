export const APP = {
  name: "PEMILU WARGA RW 09",
  subtitle: "Sistem Pendamping Pemilihan Pengurus RT & RW 09 Kelurahan Purwantoro",
  rw: "09",
  kelurahan: "Purwantoro",
} as const;

export const RT_LIST = ["RT 01", "RT 02", "RT 03", "RT 04", "RT 05", "RT 06"] as const;
export type RTCode = (typeof RT_LIST)[number];

/** Urutan status pemilihan (sesuai permintaan panitia). */
export const ELECTION_STATUSES = [
  "DRAFT",
  "TERJADWAL",
  "PERSIAPAN",
  "PEMILIHAN_BERLANGSUNG",
  "PERHITUNGAN",
  "SELESAI",
  "DITETAPKAN",
] as const;
export type ElectionStatus = (typeof ELECTION_STATUSES)[number];

export const STATUS_LABEL: Record<ElectionStatus, string> = {
  DRAFT: "Draft",
  TERJADWAL: "Terjadwal",
  PERSIAPAN: "Persiapan",
  PEMILIHAN_BERLANGSUNG: "Pemilihan berlangsung",
  PERHITUNGAN: "Perhitungan",
  SELESAI: "Selesai",
  DITETAPKAN: "Ditetapkan",
};

/**
 * Aturan yang BELUM ditetapkan panitia. Semua bernilai null/“belum ditentukan”
 * dan harus diisi lewat menu Pengaturan Pemilihan (Phase 5+). Tidak ada default tersembunyi.
 */
export const UNDECIDED_RULES = {
  MAX_RT_CHOICES: null,
  RW_SELECTION_METHOD: null,
  TIE_BREAK_RULE: null,
  RW_TOP_N_FROM_RT: null, // usulan awal 5, menunggu konfirmasi
  INVALID_VOTE_POLICY: null,
  SECOND_FACTOR_METHOD: null, // NKK dipakai bersama suami-istri; faktor kedua (kode undangan?) menunggu keputusan
} as const;
