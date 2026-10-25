# Panduan pemulihan (apa yang dilakukan jika…)

| Kejadian | Tindakan |
|---|---|
| **Internet warga mati saat memilih** | Pilihan belum tercatat sampai tombol *Konfirmasi & kirim suara* berhasil. Sambungkan ulang lalu coba lagi. Bila halaman tertutup, mulai dari awal; sesi 10 menit yang belum terpakai akan diganti. Hak suara baru hangus bila suara sudah tercatat. |
| **Internet/listrik panitia mati** | Lanjutkan dengan jalur **kertas suara**. Setelah pulih, tandai warga (Suara manual → langkah 1) dan masukkan rekap batch (langkah 2). Rekonsiliasi harus seimbang sebelum penyelesaian. |
| **Vercel/Supabase bermasalah** | Cek status.supabase.com dan vercel-status.com. Pemilihan online dapat dihentikan sementara dengan mengubah status RT; lanjutkan manual. Jangan ubah pepper/migrasi saat insiden. |
| **Warga lupa/tidak punya Nomor KK** | Minta fotokopi/foto KK; atau cari namanya di menu Pemilih → cari per nama untuk memastikan terdaftar, lalu arahkan ke jalur manual di lokasi. Panitia tidak boleh membacakan Nomor KK ke orang lain. |
| **Kode undangan hilang** | Menu Pemilih → Kode undangan → "Buat ulang semua" membuat kode baru untuk RT itu (kode lama hangus), atau arahkan memilih manual. |
| **Data warga salah (nama/alamat/RT)** | Perbaiki sebelum pemilihan RT-nya dibuka (impor ulang data yang benar atau koreksi lewat Super Admin di database). Setelah pemilihan dibuka, jangan ubah data; catat dan tangani sebagai kasus manual. |
| **Nama calon salah** | Sebelum pemilihan dibuka: ubah/hapus calon di menu Calon. Setelah dibuka, calon tidak dapat ditambah/dihapus; calon yang mengundurkan diri diberi status *Mengundurkan diri* (tidak muncul lagi di surat suara baru). |
| **Double submission (tombol ditekan dua kali)** | Aman: database menjamin satu hak suara per orang per pemilihan; kiriman kedua ditolak dengan "Hak suara Anda telah digunakan". |
| **Panitia salah input rekap manual** | Rekap tidak dapat diedit/dihapus. Catat selisih dan alasannya; Super Admin mengoreksi lewat prosedur koreksi (lihat bawah) dan memasukkan batch koreksi yang disetujui dua orang. |
| **Browser tertutup saat memilih** | Sama dengan internet mati: mulai dari awal. Jika suara sebelumnya sudah tercatat, sistem menampilkan "Hak suara Anda telah digunakan". |
| **Dugaan penyalahgunaan (banyak percobaan KK)** | Audit → filter "Batas percobaan terlampaui". Aktifkan kode undangan; catat kejadian di Berita Acara bila perlu. |
| **Pepper hilang** | Nomor KK tidak dapat dicocokkan lagi: import ulang seluruh data dengan pepper baru **sebelum** pemilihan dibuka. Jika sudah ada suara, hubungi pengembang; jangan mengubah pepper sendiri. |

## Prosedur koreksi (sementara)
Aplikasi belum memiliki layar "Permohonan Koreksi". Tabel `correction_requests` sudah ada (pemohon dan penyetuju harus orang berbeda),
sehingga koreksi dilakukan oleh Super Admin di Supabase SQL Editor dengan pencatatan di audit log dan disetujui dua orang panitia secara tertulis.
Tidak ada fitur untuk menghapus atau mengubah suara.

## Cadangan dan arsip
- Unduh Excel/CSV daftar pemilih dan hasil dari aplikasi (tercatat di audit).
- Aktifkan/periksa backup Supabase (lihat Panduan Setup bagian B).
- Setelah Berita Acara final, simpan PDF + ekspor hasil + ekspor pemilih di penyimpanan yang dikuasai panitia.
