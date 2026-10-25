# Daftar periksa sebelum membuka pemilihan

## Keputusan panitia yang harus sudah ada (sistem tidak mengarang aturan)
- [ ] Jumlah pilihan maksimal per RT (menu Pemilihan). Pemilihan tidak dapat dibuka bila kosong.
- [ ] **Faktor kedua verifikasi.** Tanpa kode undangan, siapa pun yang tahu Nomor KK dapat memilih atas nama suami/istri dalam KK itu.
      Disarankan: buat kode (Pemilih → Kode undangan), bagikan, baru aktifkan di Pengaturan.
- [ ] Kebijakan suara tidak sah / kosong. Saat ini warga **wajib memilih minimal satu calon** (tidak ada opsi kosong/abstain).
- [ ] Aturan perolehan suara sama (tie-break), metode penentuan pengurus RW, jumlah bakal calon RW dari tiap RT.
- [ ] Format nomor Berita Acara (kosong = nomor diisi manual pada dokumen cetak).

## Teknis
- [ ] Semua migrasi 0001–0004 berhasil; Super Admin dapat login; pendaftaran pengguna publik Supabase dimatikan.
- [ ] `KK_HMAC_PEPPER` tersimpan di dua tempat aman; `service_role` tidak ada di GitHub/chat.
- [ ] Turnstile aktif (site key + secret key terisi) atau panitia menerima risikonya secara tertulis.
- [ ] Simulasi penuh dengan data karangan sudah dilakukan di project latihan, termasuk di HP Android dan iPhone.
- [ ] Data pemilih: periksa rekap per RT di menu Pemilih dengan daftar manual panitia (jumlah KK, laki-laki, perempuan).
- [ ] Hak suara: contoh KK suami+istri = 2 suara, hanya salah satu = 1, anggota lain = 0.
- [ ] Calon sudah berstatus **Calon tetap**; nama kembar diperiksa (alamat berbeda tampil di kartu calon).
- [ ] Jadwal dan lokasi terisi; tautan WhatsApp sudah diuji (menu Pemilihan, saat pemilihan dibuka).
- [ ] Cadangan: ekspor daftar pemilih (Excel) dan simpan offline sebelum pemilihan dibuka.
- [ ] Panitia di lokasi membawa kertas suara cadangan dan formulir rekap untuk jalur manual.

## Saat pemilihan berlangsung
- Pantau Dashboard (otomatis segar tiap 15 detik) dan **Audit** (kejadian "Batas percobaan terlampaui" = ada yang mencoba menebak nomor KK).
- Satu pemilih = satu HP pada satu waktu; anggota keluarga lain memakai tombol "Anggota keluarga lain di KK ini".
- Jangan ubah pepper, jangan jalankan migrasi baru, jangan ganti pengaturan faktor kedua.

## Penutupan
1. **Tutup pemilihan** (status Perhitungan) → warga tidak dapat memilih lagi.
2. Masukkan rekap kertas suara manual per batch (menu Suara manual); pastikan rekonsiliasi **Seimbang**.
3. **Selesaikan & kunci hasil** → periksa menu Hasil. Bila muncul "PEROLEHAN SUARA YANG SAMA", putuskan sesuai tata tertib dan catat.
4. Buat Berita Acara → periksa → **Finalisasi** → cetak/Simpan PDF → tanda tangan.
5. Unduh ekspor hasil dan daftar pemilih sebagai arsip.
