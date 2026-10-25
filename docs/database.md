# Skema Database (PHASE 2)

## Pemisahan identitas dan pilihan
| Tabel | Isi | Terhubung ke pemilih? |
|---|---|---|
| `vote_participation` | siapa sudah memilih, kanal, kode bukti | Ya (voter_id) |
| `ballots` | satu surat suara (kanal, RT asal) | **Tidak** |
| `votes` | pilihan pada surat suara | **Tidak** |
| `manual_batches` / `manual_vote_entries` | rekap kertas suara manual per batch | **Tidak** |

Klien (browser) tidak punya akses sama sekali ke `votes`, `ballots`, `voting_sessions`, `manual_*`. Semua lewat fungsi.

## Fungsi
| Fungsi | Dipanggil oleh | Fungsi |
|---|---|---|
| `start_voting_session(kk_hash, rt_id)` | server (service_role) | langkah 1: cek Nomor KK, kembalikan daftar anggota berhak (nama tersamar), buat token sekali pakai 10 menit |
| `select_voter(token, voter_id)` | server (service_role) | langkah 2: pemilih memilih namanya dalam KK, tampilkan identitas terbatas untuk dikonfirmasi |
| `cast_ballots(token, ballots)` | server (service_role) | langkah 3: catat RT + RW dalam satu transaksi atomik |
| `record_manual_participation` | staf (Panitia/Operator/Super Admin) | tandai warga memilih manual |
| `enter_manual_tally` | staf | masukkan rekap kertas suara per batch |
| `manual_reconciliation` | staf | cocokkan jumlah peserta manual dengan kertas suara |
| `get_election_results` / `get_public_results` | staf / publik (setelah SELESAI) | hasil gabungan online + manual |

## Kode error → pesan
Lihat `src/lib/errors/messages.ts`. KK tidak ditemukan dan KK dari RT lain sengaja menghasilkan pesan yang sama (mencegah penebakan nomor KK).

## Menjalankan pengujian database
`bash supabase/tests/run_tests.sh` (butuh PostgreSQL 16 lokal; `00_supabase_shim.sql` hanya meniru Supabase, jangan dijalankan di Supabase).

## Batasan yang diketahui (dikerjakan di PHASE 15)
- `vote_participation.created_at` dan `voting_sessions.used_at` berpresisi tinggi. Admin biasa tidak bisa mengaitkan pemilih dengan pilihan (tidak ada kolom penghubung), tetapi pemilik database yang sangat teknis berpotensi menyimpulkan lewat urutan fisik baris. Mitigasi: pembulatan waktu dan pembersihan sesi terpakai.
- **NIK tidak dikumpulkan.** Nomor KK asli juga **tidak disimpan**, hanya HMAC dan versi tersamar (`3573********1234`). Konsekuensi: panitia tidak dapat melihat nomor KK lengkap setelah import.
- **Satu KK, banyak pemilih.** Siapa pun yang tahu nomor KK dapat memilih atas nama suami/istri dalam KK tersebut (kelemahan bawaan verifikasi satu faktor). Mitigasi yang sudah ada: nama tersamar, batas waktu sesi, `rate limit` (PHASE 15). Mitigasi yang disarankan: faktor kedua (lihat keputusan #1).
- `voter_eligibility` dan `documents` ditunda. Hak suara kini ditentukan kolom `has_voting_right` (diisi saat import dari kolom hubungan: SUAMI/ISTRI = berhak, lainnya = tidak). Aturan ini mengikuti ketentuan panitia: suami+istri = 2 suara, hanya salah satu = 1 suara, anggota lain tidak dihitung.
- Migrasi baru wajib mencabut hak `anon/authenticated` pada objek baru (lihat 0003).
