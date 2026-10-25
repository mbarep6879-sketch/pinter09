# Panduan Setup dan Deploy (untuk panitia)

Semua layanan di bawah ini punya paket gratis yang cukup untuk satu RW. Siapkan satu akun email yang dipegang
panitia (bukan email pribadi satu orang) agar akses tidak hilang bila orangnya berganti.

## A. Akun yang dibutuhkan
1. **GitHub** (github.com) → buat repositori **Private** bernama `pemilu-warga-rw09`, lalu unggah isi folder proyek.
   Jangan unggah berkas `.env` atau `.env.local` (sudah diabaikan oleh `.gitignore`).
2. **Supabase** (supabase.com) → *New project*. Pilih region **Southeast Asia (Singapore)**. Simpan *Database Password*
   di tempat aman. Setelah jadi, buka *Project Settings → API* dan catat: **Project URL**, **anon key**, **service_role key**.
   (`service_role` = kunci sangat rahasia; hanya boleh dimasukkan ke Vercel, tidak pernah ke chat/WhatsApp/GitHub.)
3. **Vercel** (vercel.com) → daftar dengan akun GitHub tadi.
4. *(Disarankan)* **Cloudflare Turnstile** (gratis) untuk anti-bot di halaman pemilih.

## B. Menyiapkan database (Supabase)
Buka *SQL Editor → New query*. Jalankan isi berkas **satu per satu, berurutan**, dan pastikan tiap kali muncul "Success":
1. `supabase/migrations/0001_core_schema.sql`
2. `supabase/migrations/0002_voting_functions.sql`
3. `supabase/migrations/0003_rls_and_seed.sql`
4. `supabase/migrations/0004_operations.sql`

Lalu buat Super Admin pertama (ikuti komentar di `supabase/bootstrap_super_admin.sql`).

Pengaturan wajib di Dashboard Supabase:
- *Authentication → Providers → Email*: **matikan "Allow new users to sign up"** (akun panitia hanya dibuat dari menu Pengguna).
- *Authentication → Policies/Password*: panjang kata sandi minimal 10; aktifkan perlindungan kata sandi bocor bila tersedia.
- *Database → Backups*: periksa jadwal backup. Paket gratis hanya menyimpan cadangan harian beberapa hari; untuk hari-H
  pertimbangkan paket berbayar sebulan agar tersedia *Point-in-Time Recovery*.

## C. Membuat rahasia
Di komputer yang memiliki terminal: `openssl rand -hex 32` → hasilnya (64 karakter) adalah **KK_HMAC_PEPPER**.
> **PENTING:** simpan di dua tempat aman. Jika pepper hilang atau diganti setelah import data, **semua Nomor KK warga
> tidak akan cocok lagi** dan data harus diimport ulang. Jangan ganti selama pemilihan berlangsung.

## D. Deploy ke Vercel
1. *Add New → Project* → pilih repositori GitHub → framework terdeteksi **Next.js**.
2. Isi *Environment Variables* (Production):

| Nama | Isi |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**jangan** diberi awalan NEXT_PUBLIC) |
| `KK_HMAC_PEPPER` | hasil langkah C |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | dari Cloudflare (opsional tapi disarankan) |
| `RATE_LIMIT_VERIFY_MAX` | opsional, bawaan 30 percobaan per 10 menit per alamat IP |

3. *Deploy*. Buka alamat yang diberikan Vercel, lalu masuk di `/login` dengan Super Admin tadi.
4. Di menu **Pengguna** buat akun panitia lain (Panitia, Operator, Koordinator RT, dst.).

> Catatan: variabel `NEXT_PUBLIC_*` ditanam saat *build*. Jika Anda mengubahnya di Vercel, lakukan **Redeploy**.

## E. Urutan kerja panitia di aplikasi
Menu **Persiapan** menampilkan 10 langkah berikut dan statusnya otomatis:
Import pemilih → Validasi → Jadwal → Calon → Verifikasi calon (calon tetap) → Buka pemilihan → Monitoring → Tutup →
Validasi hasil → Berita Acara.

## F. Uji coba WAJIB sebelum hari-H
Buat **project Supabase kedua** (gratis) khusus latihan, lakukan langkah B–D dengan **data karangan** (bukan data warga),
dan jalankan simulasi lengkap: import → buka RT → beberapa HP memilih → input manual → tutup → Berita Acara.
Jangan pernah memakai data warga asli untuk latihan.
