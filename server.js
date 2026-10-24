require("dotenv").config();
const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(express.json({ limit: "20kb" }));

if (!process.env.DATABASE_URL) {
  ;
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  ;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

app.use(session({
  store: new PgSession({ pool, tableName: "user_sessions", createTableIfMissing: true }),
  name: "diamondku.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const games = [
  { id: "mlbb", name: "Mobile Legends", products: [
    { id: "ml86", label: "86 Diamonds", price: 22000 },
    { id: "ml172", label: "172 Diamonds", price: 43000 }
  ]},
  { id: "ff", name: "Free Fire", products: [
    { id: "ff70", label: "70 Diamonds", price: 10000 },
    { id: "ff140", label: "140 Diamonds", price: 20000 }
  ]}
];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function layout(title, body, admin = false) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} — DiamondKu</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0c1018;color:#f4f6fb;font:16px system-ui,Arial}
header{padding:18px 5%;background:#121a28;border-bottom:1px solid #293346;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
main{max-width:900px;margin:28px auto;padding:0 16px}.brand{font-size:22px;font-weight:800;color:#7dd3fc}
.card{background:#141d2b;border:1px solid #2b374a;border-radius:16px;padding:18px;margin:14px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
label{display:block;margin:12px 0 6px;color:#cbd5e1}input,select,textarea{width:100%;padding:12px;border-radius:9px;border:1px solid #40506a;background:#0c1420;color:#fff;font:inherit}
button,.btn{display:inline-block;border:0;border-radius:9px;padding:12px 16px;background:#38bdf8;color:#07111c;font-weight:800;text-decoration:none;cursor:pointer;margin-top:12px}
small,.muted{color:#a7b2c5}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #334155;vertical-align:top}th{color:#a7dffc}
.notice{padding:12px;border-radius:10px;background:#172d3c;margin:12px 0}.danger{background:#47232a}.status{font-weight:800;color:#7dd3fc}a{color:#7dd3fc}h1{line-height:1.2}
</style></head><body><header><div class="brand">💎 DiamondKu</div><nav><a href="/">Beranda</a> · <a href="/cek-pesanan">Cek pesanan</a> · <a href="/admin">${admin ? "Panel admin" : "Admin"}</a></nav></header><main>${body}<p class="muted"><small>Demo awal. Pastikan data produk, harga, metode pembayaran, dan kebijakan layanan sudah benar sebelum digunakan publik.</small></p></main></body></html>`;
}
function csrfToken(req) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString("hex");
  return req.session.csrf;
}
function csrfField(req) {
  return `<input type="hidden" name="_csrf" value="${escapeHtml(csrfToken(req))}">`;
}
function verifyCsrf(req, res, next) {
  if (!req.body._csrf || !req.session.csrf ||
      !crypto.timingSafeEqual(Buffer.from(req.body._csrf), Buffer.from(req.session.csrf))) {
    return res.status(403).send(layout("Permintaan ditolak", "<div class='card'>Sesi formulir kedaluwarsa. Kembali dan coba lagi.</div>"));
  }
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect("/admin/login");
  next();
}
function rupiah(n) { return new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(n); }
function findProduct(gameId, productId) {
  const game = games.find(g => g.id === gameId);
  const product = game && game.products.find(p => p.id === productId);
  return game && product ? { game, product } : null;
}
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      game_id TEXT NOT NULL,
      game_name TEXT NOT NULL,
      player_id TEXT NOT NULL,
      server_id TEXT DEFAULT '',
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      payment_status TEXT NOT NULL DEFAULT 'awaiting_payment',
      fulfillment_status TEXT NOT NULL DEFAULT 'not_started',
      admin_note TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC)");
}

app.get("/health", async (req, res) => {
  try { await pool.query("SELECT 1"); res.json({ ok: true, database: "connected" }); }
  catch (e) { res.status(503).json({ ok: false, database: "error" }); }
});

app.get("/", (req, res) => {
  const cards = games.map(g => `<div class="card"><h2>${escapeHtml(g.name)}</h2>${g.products.map(p =>
    `<p>${escapeHtml(p.label)} — <b>${rupiah(p.price)}</b></p>`).join("")}</div>`).join("");
  res.send(layout("Top Up Game", `<section class="card"><h1>Top Up Game Mudah di DiamondKu</h1><p class="muted">Pilih produk, isi ID pemain, lalu admin akan memproses pesanan setelah pembayaran diverifikasi.</p><a class="btn" href="/pesan">Buat pesanan</a></section><div class="grid">${cards}</div><section class="card"><h2>Sudah memesan?</h2><a href="/cek-pesanan">Cek status pesanan</a></section>`));
});

app.get("/pesan", (req, res) => {
  const options = games.map(g => g.products.map(p =>
    `<option value="${g.id}|${p.id}">${escapeHtml(g.name)} — ${escapeHtml(p.label)} (${rupiah(p.price)})</option>`).join("")).join("");
  res.send(layout("Buat Pesanan", `<div class="card"><h1>Buat pesanan</h1><div class="notice">Harga di bawah adalah contoh awal. Pemilik wajib menyesuaikan katalog dan harga sebelum dipublikasikan.</div>
<form method="post" action="/pesan">${csrfField(req)}
<label>Nama</label><input name="customer_name" maxlength="80" required>
<label>Nomor WhatsApp</label><input name="whatsapp" maxlength="25" required>
<label>Game dan nominal</label><select name="selection" required>${options}</select>
<label>ID pemain / User ID</label><input name="player_id" maxlength="80" required>
<label>Server ID (jika diperlukan)</label><input name="server_id" maxlength="40">
<button type="submit">Buat pesanan</button></form></div>`));
});

app.post("/pesan", verifyCsrf, async (req, res) => {
  try {
    const name = String(req.body.customer_name || "").trim();
    const whatsapp = String(req.body.whatsapp || "").trim();
    const playerId = String(req.body.player_id || "").trim();
    const serverId = String(req.body.server_id || "").trim();
    const [gameId, productId] = String(req.body.selection || "").split("|");
    const selected = findProduct(gameId, productId);
    if (!name || name.length > 80 || !whatsapp || whatsapp.length > 25 ||
        !playerId || playerId.length > 80 || serverId.length > 40 || !selected) {
      return res.status(400).send(layout("Data tidak valid", "<div class='card'>Data tidak valid. Periksa formulir.</div>"));
    }
    const id = "DK" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString("hex").toUpperCase();
    await pool.query(`INSERT INTO orders
      (id, customer_name, whatsapp, game_id, game_name, player_id, server_id, product_id, product_name, amount)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id,name,whatsapp,gameId,selected.game.name,playerId,serverId,productId,selected.product.label,selected.product.price]);
    res.redirect("/pesanan/" + encodeURIComponent(id));
  } catch (e) {
    console.error("Gagal membuat pesanan", e.message);
    res.status(500).send(layout("Gangguan", "<div class='card'>Pesanan belum dapat dibuat. Coba lagi nanti.</div>"));
  }
});

app.get("/pesanan/:id", async (req, res) => {
  const result = await pool.query("SELECT id, game_name, product_name, amount, payment_status, fulfillment_status, created_at FROM orders WHERE id=$1", [req.params.id]);
  if (!result.rowCount) return res.status(404).send(layout("Pesanan tidak ditemukan", "<div class='card'>Nomor pesanan tidak ditemukan.</div>"));
  const o = result.rows[0];
  res.send(layout("Detail Pesanan", `<div class="card"><h1>Pesanan dibuat</h1><p>Nomor pesanan: <b>${escapeHtml(o.id)}</b></p><p>${escapeHtml(o.game_name)} — ${escapeHtml(o.product_name)}</p><h2>${rupiah(o.amount)}</h2><p>Status pembayaran: <span class="status">${escapeHtml(o.payment_status)}</span></p><p>Status top-up: <span class="status">${escapeHtml(o.fulfillment_status)}</span></p><p class="muted">Simpan nomor pesanan ini untuk mengecek status. Instruksi pembayaran resmi harus ditambahkan sebelum menerima uang.</p><a href="/cek-pesanan">Cek pesanan</a></div>`));
});

app.get("/cek-pesanan", (req, res) => {
  res.send(layout("Cek Pesanan", `<div class="card"><h1>Cek status pesanan</h1><form method="get" action="/cek-pesanan"><label>Nomor pesanan</label><input name="id" required value="${escapeHtml(req.query.id || "")}"><button type="submit">Cari</button></form>${req.query.id ? `<p>Jika nomor benar, <a href="/pesanan/${encodeURIComponent(String(req.query.id).slice(0,100))}">buka status pesanan</a>.</p>` : ""}</div>`));
});

app.get("/admin", (req, res) => res.redirect("/admin/pesanan"));
app.get("/admin/login", (req, res) => {
  res.send(layout("Login Admin", `<div class="card"><h1>Login admin</h1><p class="muted">Halaman ini hanya untuk pemilik/operator resmi.</p><form method="post" action="/admin/login">${csrfField(req)}<label>Username</label><input name="username" autocomplete="username" required><label>Password</label><input type="password" name="password" autocomplete="current-password" required><button type="submit">Masuk</button></form></div>`));
});
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
app.post("/admin/login", loginLimiter, verifyCsrf, async (req, res) => {
  const username = process.env.ADMIN_USERNAME;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!username || !hash) return res.status(503).send(layout("Admin belum dikonfigurasi", "<div class='card'>Atur ADMIN_USERNAME dan ADMIN_PASSWORD_HASH di hosting.</div>"));
  const ok = String(req.body.username) === username && await bcrypt.compare(String(req.body.password || ""), hash);
  if (!ok) return res.status(401).send(layout("Login gagal", "<div class='card danger'>Username atau password salah. <a href='/admin/login'>Coba lagi</a>.</div>"));
  req.session.regenerate(err => {
    if (err) return res.status(500).send("Gagal membuat sesi. Coba lagi.");
    req.session.admin = true;
    req.session.csrf = crypto.randomBytes(24).toString("hex");
    res.redirect("/admin/pesanan");
  });
});
app.post("/admin/logout", requireAdmin, verifyCsrf, (req, res) => req.session.destroy(() => res.redirect("/")));

app.get("/admin/pesanan", requireAdmin, async (req, res) => {
  const result = await pool.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100");
  const rows = result.rows.map(o => `<tr><td><b>${escapeHtml(o.id)}</b><br><small>${new Date(o.created_at).toLocaleString("id-ID")}</small></td><td>${escapeHtml(o.customer_name)}<br>${escapeHtml(o.whatsapp)}<br><small>${escapeHtml(o.game_name)} · ID ${escapeHtml(o.player_id)} ${escapeHtml(o.server_id)}</small><br>${escapeHtml(o.product_name)} — ${rupiah(o.amount)}</td><td>${escapeHtml(o.payment_status)}<br>${escapeHtml(o.fulfillment_status)}</td><td><form method="post" action="/admin/pesanan/${encodeURIComponent(o.id)}">${csrfField(req)}<label>Pembayaran</label><select name="payment_status"><option value="awaiting_payment" ${o.payment_status==="awaiting_payment"?"selected":""}>Menunggu pembayaran</option><option value="paid" ${o.payment_status==="paid"?"selected":""}>Terverifikasi lunas</option><option value="cancelled" ${o.payment_status==="cancelled"?"selected":""}>Dibatalkan</option><option value="refunded" ${o.payment_status==="refunded"?"selected":""}>Dikembalikan</option></select><label>Top-up</label><select name="fulfillment_status"><option value="not_started" ${o.fulfillment_status==="not_started"?"selected":""}>Belum diproses</option><option value="processing" ${o.fulfillment_status==="processing"?"selected":""}>Sedang diproses</option><option value="delivered" ${o.fulfillment_status==="delivered"?"selected":""}>Berhasil dikirim</option><option value="failed" ${o.fulfillment_status==="failed"?"selected":""}>Gagal</option></select><label>Catatan internal</label><input name="admin_note" maxlength="500" value="${escapeHtml(o.admin_note || "")}"><button type="submit">Simpan status</button></form></td></tr>`).join("");
  res.send(layout("Pesanan Admin", `<div class="card"><h1>Panel admin</h1><p>Menampilkan maksimal 100 pesanan terbaru. Verifikasi pembayaran melalui rekening/payment provider terlebih dahulu. Jangan menandai delivered sebelum top-up berhasil.</p><form method="post" action="/admin/logout">${csrfField(req)}<button type="submit">Keluar</button></form></div><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Pesanan</th><th>Detail</th><th>Status</th><th>Kelola</th></tr></thead><tbody>${rows || "<tr><td colspan='4'>Belum ada pesanan.</td></tr>"}</tbody></table></div></div>`, true));
});
app.post("/admin/pesanan/:id", requireAdmin, verifyCsrf, async (req, res) => {
  const allowedPayment = ["awaiting_payment","paid","cancelled","refunded"];
  const allowedFulfillment = ["not_started","processing","delivered","failed"];
  const payment = String(req.body.payment_status);
  const fulfillment = String(req.body.fulfillment_status);
  const note = String(req.body.admin_note || "").slice(0,500);
  if (!allowedPayment.includes(payment) || !allowedFulfillment.includes(fulfillment)) return res.status(400).send("Status tidak valid.");
  if (fulfillment === "delivered" && payment !== "paid") return res.status(400).send(layout("Status ditolak", "<div class='card'>Top-up hanya boleh ditandai berhasil setelah pembayaran terverifikasi lunas.</div>"));
  await pool.query("UPDATE orders SET payment_status=$1, fulfillment_status=$2, admin_note=$3, updated_at=NOW() WHERE id=$4",
    [payment,fulfillment,note,req.params.id]);
  res.redirect("/admin/pesanan");
});

app.use((err, req, res, next) => {
  console.error("Kesalahan aplikasi:", err.message);
  res.status(500).send(layout("Gangguan", "<div class='card'>Terjadi gangguan. Coba lagi nanti.</div>"));
});

const port = Number(process.env.PORT || 3000);
initDb().then(() => app.listen(port, "0.0.0.0", () => console.log(`DiamondKu berjalan pada port ${port}`)))
  .catch(err => { console.error("Inisialisasi database gagal:", err.message); process.exit(1); });
