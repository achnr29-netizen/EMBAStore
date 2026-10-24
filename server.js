import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { createMidtransPayment, normalizePaymentStatus, verifyMidtransNotification } from './payments.js';
import { submitTopup } from './topup.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '30kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: true, legacyHeaders: false }));
app.use(express.static(path.join(__dirname, '../public')));
const now = () => new Date().toISOString();
const publicOrder = o => ({ id:o.id, game:o.game, product_name:o.product_name, amount:o.amount, price_idr:o.price_idr, payment_method:o.payment_method, payment_status:o.payment_status, fulfillment_status:o.fulfillment_status, created_at:o.created_at });

app.get('/api/health', (_req,res) => res.json({ ok:true, service:'DiamondKu API' }));
app.get('/api/products', (_req,res) => {
  const rows = db.prepare('SELECT sku,game,name,currency,amount,price_idr FROM products WHERE active=1 ORDER BY game, amount').all();
  res.json({ products: rows });
});
app.post('/api/orders', (req,res) => {
  const { player_id, server_id='', buyer_contact='', sku, payment_method='online' } = req.body || {};
  if (typeof player_id !== 'string' || !/^[a-zA-Z0-9_-]{3,40}$/.test(player_id.trim())) return res.status(400).json({ error:'ID pemain wajib diisi (3–40 karakter, huruf/angka/_/-).' });
  if (typeof server_id !== 'string' || server_id.length > 40) return res.status(400).json({ error:'Server ID tidak valid.' });
  if (typeof buyer_contact !== 'string' || buyer_contact.length > 30) return res.status(400).json({ error:'Kontak tidak valid.' });
  const allowedMethods = ['online','qris','bca','dana','gopay'];
  if (!allowedMethods.includes(payment_method)) return res.status(400).json({ error:'Metode pembayaran tidak didukung.' });
  const product = db.prepare('SELECT * FROM products WHERE sku=? AND active=1').get(sku);
  if (!product) return res.status(400).json({ error:'Paket tidak ditemukan atau tidak aktif.' });
  const id = `DK-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const timestamp = now();
  db.prepare(`INSERT INTO orders (id,player_id,server_id,buyer_contact,sku,game,product_name,amount,price_idr,payment_method,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,player_id.trim(),server_id.trim()||null,buyer_contact.trim()||null,product.sku,product.game,product.name,product.amount,product.price_idr,payment_method,timestamp,timestamp);
  res.status(201).json({ order: publicOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(id)) });
});
app.post('/api/orders/:id/payment', async (req,res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error:'Pesanan tidak ditemukan.' });
  if (order.payment_status === 'paid') return res.status(409).json({ error:'Pesanan sudah dibayar.' });
  try {
    const payment = await createMidtransPayment(order);
    db.prepare('UPDATE orders SET payment_ref=?,updated_at=? WHERE id=?').run(payment.token,now(),order.id);
    res.json({ order_id:order.id, payment_url:payment.redirect_url, payment_token:payment.token });
  } catch (e) { res.status(503).json({ error:'Pembayaran belum tersedia.', detail:process.env.NODE_ENV==='development'?e.message:undefined }); }
});
app.post('/api/webhooks/midtrans', (req,res) => {
  const n = req.body;
  if (!verifyMidtransNotification(n)) return res.status(401).json({ error:'Signature tidak valid.' });
  const eventKey = crypto.createHash('sha256').update(JSON.stringify(n)).digest('hex');
  const insert = db.prepare('INSERT OR IGNORE INTO webhook_events (event_key,received_at) VALUES (?,?)').run(eventKey,now());
  if (!insert.changes) return res.json({ received:true, duplicate:true });
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(n.order_id);
  if (!order) return res.status(404).json({ error:'Pesanan tidak ditemukan.' });
  // Reject any amount mismatch before trusting a paid notification.
  if (Number(n.gross_amount) !== Number(order.price_idr)) return res.status(400).json({ error:'Nominal pembayaran tidak cocok.' });
  const status = normalizePaymentStatus(n);
  db.prepare('UPDATE orders SET payment_status=?,updated_at=? WHERE id=?').run(status,now(),order.id);
  if (status === 'paid' && order.fulfillment_status === 'waiting_payment') {
    db.prepare('UPDATE orders SET fulfillment_status=?,updated_at=? WHERE id=?').run('queued',now(),order.id);
    // Production: enqueue a durable background job here; never make fulfillment depend on webhook latency.
  }
  res.json({ received:true });
});
app.get('/api/orders/:id', (req,res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error:'Pesanan tidak ditemukan.' });
  // Public response intentionally excludes player ID, contact, and payment/provider secrets.
  res.json({ order: publicOrder(order) });
});
function requireAdmin(req,res,next) {
  const configured = process.env.ADMIN_API_KEY;
  if (!configured || configured.includes('REPLACE_WITH')) return res.status(503).json({ error:'ADMIN_API_KEY belum dikonfigurasi.' });
  const given = req.get('x-admin-key') || '';
  const a=Buffer.from(given), b=Buffer.from(configured);
  if (a.length!==b.length || !crypto.timingSafeEqual(a,b)) return res.status(401).json({ error:'Tidak diizinkan.' });
  next();
}
app.get('/api/admin/orders', requireAdmin, (req,res) => {
  const status = typeof req.query.payment_status==='string' ? req.query.payment_status : null;
  const rows = status ? db.prepare('SELECT * FROM orders WHERE payment_status=? ORDER BY created_at DESC LIMIT 200').all(status) : db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200').all();
  res.json({ orders:rows.map(publicOrder) });
});
app.post('/api/admin/orders/:id/fulfill', requireAdmin, async (req,res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error:'Pesanan tidak ditemukan.' });
  if (order.payment_status !== 'paid') return res.status(409).json({ error:'Pesanan belum terverifikasi dibayar.' });
  if (order.fulfillment_status === 'delivered') return res.status(409).json({ error:'Pesanan sudah dikirim.' });
  try {
    const result = await submitTopup(order);
    db.prepare('UPDATE orders SET fulfillment_status=?,updated_at=? WHERE id=?').run(result.status==='delivered'?'delivered':'manual_review',now(),order.id);
    res.json({ order_id:order.id, result });
  } catch (e) { res.status(502).json({ error:'Penyedia top up gagal atau adapter belum siap.', detail:process.env.NODE_ENV==='development'?e.message:undefined }); }
});
app.use((err,_req,res,_next) => { console.error(err); res.status(500).json({ error:'Terjadi kesalahan pada server.' }); });
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`DiamondKu running on ${process.env.BASE_URL || `http://localhost:${port}`}`));
