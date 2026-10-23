# DiamondKu Starter — Top-up manual

Starter ini membuat website Node.js/Express dengan PostgreSQL, halaman katalog, pembuatan pesanan, cek status, login admin berbasis sesi, dan pembaruan status manual.

## Penting sebelum dipublikasikan
- Produk dan harga dalam `server.js` adalah CONTOH. Ganti dengan produk dan harga yang benar.
- Starter ini belum mengintegrasikan payment gateway atau API provider top-up.
- Jangan meminta password akun game pelanggan.
- Jangan menganggap screenshot transfer sebagai bukti pembayaran final. Periksa transaksi di sumber resmi.
- Uji keamanan dan backup sebelum menerima transaksi nyata.
- Endpoint health adalah `/health`.

## Deploy menggunakan Render
1. Buat database PostgreSQL di Render.
2. Buat repositori GitHub private dan unggah seluruh isi folder ini.
3. Buat Web Service di Render dari repositori tersebut.
4. Build command: `npm install`; start command: `npm start`.
5. Tambahkan environment variables:
   - `NODE_ENV=production`
   - `BASE_URL=https://URL-WEBSITE-RENDER`
   - `DATABASE_URL` = internal database URL dari Render
   - `SESSION_SECRET` = string acak panjang minimal 32 karakter
   - `ADMIN_USERNAME` = username admin yang unik
   - `ADMIN_PASSWORD_HASH` = hash bcrypt password admin
6. Untuk membuat hash di komputer dengan Node.js:
   `node -e "console.log(require('bcryptjs').hashSync('GANTI_DENGAN_PASSWORD_KUAT', 12))"`
   Jalankan hanya secara lokal, ganti password contoh dengan password kuat, lalu masukkan hasil hash ke `ADMIN_PASSWORD_HASH`. Jangan pernah membagikan password atau hash ke chat.
7. Buka `https://URL-WEBSITE-RENDER/health`. Respons yang diharapkan: `{"ok":true,"database":"connected"}`.
8. Buka `/admin/login` dan masuk memakai kredensial yang kamu atur.

## Uji manual
1. Buat pesanan uji.
2. Login ke `/admin/pesanan`.
3. Pastikan pesanan muncul dan ID/harga benar.
4. Uji perubahan status.
5. Pastikan status top-up tidak dapat menjadi `delivered` jika pembayaran bukan `paid`.

## Keterbatasan starter
- Tidak ada Midtrans, QRIS otomatis, notifikasi WhatsApp, refund otomatis, audit log lengkap, atau provider top-up API.
- Pelanggan bisa melihat status melalui ID pesanan; gunakan nomor pesanan yang sulit ditebak dan jangan masukkan data sensitif di halaman status.
- Katalog dan harga ditulis di kode, bukan dikelola dari database/admin.
- Untuk produksi, tambahkan audit log, CSRF hardening, pemantauan, backup teruji, aturan privasi, syarat layanan, dan kebijakan refund.
