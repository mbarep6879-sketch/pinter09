# Model keamanan (ringkas)

## Prinsip yang ditegakkan oleh database (bukan hanya tampilan)
- **1 orang = 1 hak suara per pemilihan**: `UNIQUE(voter_id, election_id)` + penguncian baris. Diuji dengan 20 perangkat serentak → tepat 1 suara.
- **Identitas dan pilihan dipisah**: `votes`/`ballots` tidak memuat `voter_id` maupun waktu. Klien browser tidak punya akses sama sekali ke tabel itu.
- **Suara tidak dapat diubah/dihapus**: trigger menolak UPDATE/DELETE/TRUNCATE pada suara, partisipasi, rekap manual, dan audit.
- **Hasil terkunci** saat status Selesai; status hanya berubah lewat fungsi yang memeriksa prasyarat dan alur.
- **Nomor KK tidak disimpan**: hanya HMAC-SHA256 (dengan pepper rahasia) dan versi tersamar `3573********1234`. NIK tidak dikumpulkan.
- **Tiga lapis otorisasi**: middleware (wajib login) → pemeriksaan role di server → RLS/fungsi database. Fungsi sensitif hanya dapat dipanggil server (`service_role`).
- **Anti-enumerasi**: KK tidak ditemukan, KK di RT lain, atau kode undangan salah memberi pesan yang sama.
- **Batas percobaan** per alamat IP dan per KK (di database), Turnstile opsional, kejadian pelampauan batas tercatat di audit.
- **Ekspor aman**: sel berawalan `= + - @` dinetralkan agar tidak menjadi formula Excel.

## Pengujian otomatis
- 163 pemeriksaan database (termasuk daftar putih fungsi/tabel yang boleh diakses klien, dengan meniru *default privileges* Supabase).
- 8 uji integrasi layanan → API (PostgREST + JWT), 19 uji asap HTTP pada build produksi.
- 53+ uji unit (import, role, hash, ekspor, error).

## Batasan yang diketahui (jujur)
1. **Belum diuji pada Supabase asli** (khususnya login Supabase Auth, penyimpanan cookie sesi, pengiriman email). Lakukan uji penuh di project latihan.
2. **Satu faktor secara bawaan.** Tanpa kode undangan, orang yang tahu Nomor KK bisa memilih atas nama suami/istri di KK itu. Aktifkan kode undangan.
3. **Privasi pilihan tidak mutlak terhadap pemilik database.** Admin aplikasi tidak bisa mengaitkan pemilih dengan pilihannya, tetapi pemilik database yang
   sangat teknis dapat berspekulasi lewat waktu partisipasi dan urutan penyimpanan. Pembulatan waktu belum dilakukan.
4. **Tidak ada CSP ketat** (hanya header dasar: HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).
5. **Pembatasan percobaan berbasis IP** dapat menahan banyak warga yang memakai Wi-Fi yang sama; naikkan `RATE_LIMIT_VERIFY_MAX` bila perlu.
6. **Tidak ada layanan offline/service worker**: aplikasi sengaja menolak pemungutan suara tanpa internet. Manifest PWA ada, kemampuan *install* bergantung peramban.
7. Pembaruan dashboard memakai penyegaran berkala 10–15 detik, bukan Supabase Realtime.
