# PEMILU WARGA RW 09
Sistem Pendamping Pemilihan Pengurus RT & RW 09 Kelurahan Purwantoro.

Next.js 15 · TypeScript · Tailwind · Supabase (PostgreSQL + Auth + RLS) · Vercel.

## Mulai dari sini
1. **`docs/PANDUAN-SETUP.md`** — membuat akun, menyiapkan database, deploy (untuk panitia).
2. **`docs/CHECKLIST-GO-LIVE.md`** — keputusan dan pemeriksaan sebelum pemilihan dibuka.
3. `docs/PEMULIHAN.md` — apa yang dilakukan bila internet/listrik/server bermasalah.
4. `docs/KEAMANAN.md` — model keamanan dan batasan yang diketahui.
5. `docs/keputusan-panitia.md`, `docs/database.md` — aturan yang menunggu keputusan dan rancangan database.

## Alur warga
Nomor KK (+ kode undangan bila diaktifkan) → pilih nama di dalam KK → konfirmasi identitas → pilih calon RT (+ bakal calon RW) → konfirmasi → bukti `VOTE-XXXX-XXXX`.

## Pengembangan
```bash
npm install
cp .env.example .env.local        # isi nilai Supabase dan KK_HMAC_PEPPER
npm run dev
npm test                          # uji unit (cepat)
npm run test:db                   # uji database (butuh PostgreSQL 16 lokal)
npm run test:integration          # uji integrasi + uji asap HTTP (butuh PostgreSQL 16 + binari PostgREST di /tmp/postgrest)
```
Migrasi: `supabase/migrations/0001…0004` (jalankan berurutan). Super Admin pertama: `supabase/bootstrap_super_admin.sql`.

## Aturan emas
- Jangan unggah data warga ke repositori, chat, atau layanan AI. Data dimasukkan lewat menu **Import** setelah deploy.
- `SUPABASE_SERVICE_ROLE_KEY` dan `KK_HMAC_PEPPER` hanya di environment server (Vercel), tidak pernah di kode.
- Nomor KK tidak disimpan utuh dan tidak masuk URL, localStorage, log, atau pesan error.
