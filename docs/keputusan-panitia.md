# Keputusan yang menunggu panitia
Sampai diputuskan, nilainya dibuat konfigurasi kosong (`UNDECIDED_RULES` di `src/lib/constants.ts`). Sistem tidak akan mengarang aturan.

| # | Aturan | Status | Rekomendasi sementara |
|---|---|---|---|
| 1 | Faktor kedua verifikasi. Nomor KK dipakai bersama suami-istri, jadi siapa pun yang tahu NKK bisa memilih atas nama pasangan | Belum | Kode undangan per KK dari panitia (dibagikan bersama pemberitahuan), atau tanpa faktor kedua dengan risiko diterima panitia |
| 2 | MAX_RT_CHOICES | Belum | - |
| 3 | Metode penjaringan/pemilihan RW (RW_SELECTION_METHOD) | Belum | - |
| 4 | Jumlah bakal calon RW dari tiap RT | Belum | 5 teratas (sesuai draf) |
| 5 | TIE_BREAK_RULE | Belum | Keputusan manual panitia, tercatat di audit |
| 6 | Kebijakan suara tidak sah / opsi kosong | Belum | - |
| 7 | Kolom hubungan di file import (suami/istri/lainnya) | **Diperlukan** | Import mewajibkan kolom `hubungan`; hak suara = SUAMI atau ISTRI |
| 8 | Format nomor dokumen Berita Acara | Belum | contoh: 001/BA-RT03/RW09/2026 |
| 9 | Cakupan DOCX & kalender rilis pertama | Belum | PDF dulu, DOCX di akhir |
