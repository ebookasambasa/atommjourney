# Atom Journey — Server Tahap 2

Paket ini berisi server (Node.js + Express + SQLite) yang menyimpan jawaban
siswa di satu tempat dan menyediakan tombol unduh data (Excel) khusus guru,
sesuai rancangan yang sudah disepakati.

## Isi Folder
- `server.js` — server utama (API + menyajikan halaman web)
- `public/index.html` — halaman Atom Journey (sudah terhubung ke server ini)
- `package.json` — daftar library yang dibutuhkan
- `data.sqlite` — database (dibuat otomatis saat server pertama kali jalan)

## Cara Deploy (via Railway — gratis untuk skala kecil)

1. **Buat akun** di https://railway.app (bisa daftar pakai akun GitHub).
2. **Buat project baru** → pilih "Deploy from GitHub repo" (unggah folder ini ke
   repository GitHub baru terlebih dahulu), ATAU pilih opsi "Empty Project"
   lalu upload folder ini lewat Railway CLI (`railway up`) kalau tidak ingin
   pakai GitHub.
3. Railway akan otomatis mendeteksi `package.json` dan menjalankan
   `npm install` lalu `npm start`.
4. **Atur Environment Variable** (bagian "Variables" di dashboard Railway):
   - `TEACHER_PASSWORD` = password rahasia pilihan Bapak/Ibu (contoh: `atom2026rahasia`)
   - Ini WAJIB diisi — tanpa ini, tombol unduh guru tidak akan berfungsi.
5. Setelah deploy selesai, Railway memberi alamat permanen, contoh:
   `https://atom-journey-production.up.railway.app`
6. Bagikan alamat itu ke siswa — mereka tinggal buka lewat browser (HP/laptop),
   tidak perlu instal apa pun.

## Cara Deploy (alternatif — Render.com)
Prosesnya mirip: buat akun di https://render.com, pilih "New Web Service",
hubungkan ke repo/folder ini, isi Environment Variable `TEACHER_PASSWORD`,
lalu deploy. Render juga punya paket gratis untuk skala kecil.

## Cara Guru Mengunduh Data
1. Buka alamat website yang sama seperti siswa.
2. Scroll ke bagian paling bawah, klik tombol **"🔒 Unduh Data (Khusus Guru)"**.
3. Akan muncul 3 kotak dialog berurutan:
   - Masukkan **password** (sesuai `TEACHER_PASSWORD` di atas)
   - Masukkan **kelas** (contoh: `X-2`)
   - Masukkan **tanggal sesi** (format `2026-09-17`), atau kosongkan untuk hari ini
4. File Excel otomatis terunduh, berisi 2 sheet:
   - **Exploration (Referensi)** — jawaban lembar kerja, TIDAK dinilai
   - **Elaboration (Dasar Penilaian)** — skor Kartu Sortir otomatis + jawaban
     Galeri Betulkan Kesalahan + kolom skor Dimensi/TP kosong untuk diisi manual

## Catatan Penting
- **Konsep Sesi saat ini otomatis** berdasarkan gabungan Kelas + Tanggal hari
  siswa mengisi (bukan input manual guru). Jadi kalau kelas X-2 mengisi pada
  17 September 2026, semua datanya otomatis satu sesi. Ini penyederhanaan
  awal — kalau nanti perlu sesi dengan label bebas (bukan cuma tanggal),
  tinggal beri tahu untuk dikembangkan lebih lanjut.
- Auto-save siswa tetap didahulukan tersimpan di localStorage perangkat
  masing-masing sebagai cadangan; begitu koneksi ke server berhasil, data
  otomatis disinkronkan (setiap ~0.7 detik setelah siswa berhenti mengetik).
- **Jangan bagikan file/folder ini secara publik dengan `TEACHER_PASSWORD`
  tertulis di dalamnya** — isi password hanya lewat Environment Variable di
  dashboard hosting, jangan ditulis langsung di `server.js`.
