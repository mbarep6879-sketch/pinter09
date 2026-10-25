-- Membuat Super Admin PERTAMA. Jalankan SEKALI di Supabase SQL Editor setelah semua migrasi.
--
-- Langkah:
-- 1) Supabase Dashboard > Authentication > Users > "Add user" > isi email + kata sandi kuat,
--    centang "Auto Confirm User".
-- 2) Ganti email dan nama di bawah, lalu jalankan.
--
-- Pengguna panitia berikutnya dibuat dari aplikasi (menu Pengguna), bukan dari sini.

insert into public.profiles (id, nama, role)
select id, 'GANTI DENGAN NAMA ANDA', 'SUPER_ADMIN'
from auth.users
where email = 'GANTI@DENGAN.EMAIL.ANDA'
on conflict (id) do update set role = 'SUPER_ADMIN', is_active = true;

-- Pastikan berhasil (harus menampilkan 1 baris):
select p.nama, p.role, u.email from public.profiles p join auth.users u on u.id = p.id where p.role = 'SUPER_ADMIN';
