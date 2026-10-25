/**
 * Memetakan kode error dari database/server ke pesan manusiawi.
 * Pesan mentah (mis. "PostgrestException 23505") TIDAK PERNAH ditampilkan ke pengguna,
 * dan pesan tidak boleh memuat nomor KK.
 */
const MESSAGES: Record<string, string> = {
  ALREADY_VOTED: "Hak suara Anda telah digunakan.",
  VOTER_NOT_FOUND: "Nomor KK tidak ditemukan untuk RT yang dipilih. Periksa kembali atau hubungi panitia.",
  VOTER_NOT_SELECTED: "Silakan pilih nama Anda terlebih dahulu.",
  NO_VOTING_RIGHT: "Data Anda belum terdaftar sebagai pemilih. Silakan hubungi panitia.",
  ELECTION_NOT_OPEN: "Pemilihan belum dibuka atau sudah ditutup.",
  ELECTION_LOCKED: "Data pemilihan ini sudah dikunci dan tidak dapat diubah.",
  SESSION_INVALID: "Sesi pemilihan tidak valid. Silakan mulai kembali.",
  SESSION_EXPIRED: "Sesi pemilihan sudah berakhir. Silakan mulai kembali.",
  CHOICE_EMPTY: "Silakan pilih minimal satu calon.",
  CHOICE_TOO_MANY: "Jumlah pilihan melebihi batas yang ditentukan.",
  CANDIDATE_INVALID: "Calon yang dipilih tidak valid.",
  CANDIDATE_WRONG_RT: "Calon pengurus RT harus warga RT yang sama.",
  WRONG_RT: "Pilihan tidak sesuai dengan RT Anda.",
  RULE_NOT_CONFIGURED: "Aturan pemilihan belum ditetapkan panitia.",
  RESULT_NOT_PUBLISHED: "Hasil belum diumumkan.",
  TALLY_MISMATCH: "Jumlah suara lebih kecil dari jumlah kertas suara. Periksa kembali hitungan.",
  IMMUTABLE_RECORD: "Data ini tidak dapat diubah. Gunakan permohonan koreksi.",
  FORBIDDEN: "Anda tidak memiliki kewenangan untuk melakukan tindakan ini.",
  NOT_FOUND: "Data tidak ditemukan.",
  IMPORT_HAS_ERRORS: "Masih ada baris bermasalah. Perbaiki berkas, atau setujui impor hanya untuk baris yang valid.",
  IMPORT_NOT_STAGED: "Impor ini sudah diproses atau dibatalkan.",
  INVALID_TRANSITION: "Perubahan status tersebut tidak diperbolehkan pada tahap saat ini.",
  PREREQUISITE_FAILED: "Prasyarat belum terpenuhi (metode, jumlah pilihan, atau calon yang sah).",
  RECONCILIATION_FAILED: "Jumlah kertas suara manual belum cocok dengan jumlah peserta manual.",
  ELECTION_NOT_CLOSED: "Dokumen hanya dapat dibuat setelah pemilihan selesai.",
  DOCUMENT_LOCKED: "Dokumen sudah final dan tidak dapat diubah.",
  SOURCE_RT_REQUIRED: "RT asal kertas suara harus dipilih.",
};

const FALLBACK = "Terjadi kendala. Silakan coba lagi atau hubungi panitia.";

export function humanizeError(raw: unknown): string {
  const text = raw instanceof Error ? raw.message : typeof raw === "string" ? raw : "";
  const code = Object.keys(MESSAGES).find((c) => text.includes(c));
  if (code) return MESSAGES[code];
  if (/23505|duplicate key/i.test(text)) return "Data tersebut sudah terdaftar.";
  if (/42501|permission denied|row-level security/i.test(text)) return MESSAGES.FORBIDDEN;
  return FALLBACK;
}
