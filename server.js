import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import bcrypt from 'bcryptjs';
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
app.use(express.static(__dirname));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));
const now = () => new Date().toISOString();
const publicOrder = o => ({ id:o.id, game:o.game, product_name:o.product_name, amount:o.amount, price_idr:o.price_idr, payment_method:o.payment_method, payment_status:o.payment_status, fulfillment_status:o.fulfillment_status, created_at:o.created_at });

const publicUser = user => ({
  id: user.id,
  name: user.name,
  email: user.email,
  picture: user.picture || null
});

app.get('/api/health', (_req,res) => res.json({ ok:true, service:'DiamondKu API' }));
app.get('/api/config/google', (_req,res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  res.json({
    client_id: clientId && !clientId.includes('REPLACE_WITH') ? clientId : null
  });
});
app.get('/api/auth/me', (req,res) => {
  if (!req.session?.userId) return res.status(401).json({ user:null });
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId);
  if (!user) return res.status(401).json({ user:null });
  res.json({ user:publicUser(user) });
});
app.post('/api/auth/register', async (req,res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error:'Nama harus 2–60 karakter.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error:'Email tidak valid.' });
  if (password.length < 6 || password.length > 72) return res.status(400).json({ error:'Password minimal 6 karakter.' });
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).json({ error:'Email sudah terdaftar.' });
  const id = `USR-${crypto.randomBytes(8).toString('hex')}`;
  const timestamp = now();
  const passwordHash = await bcrypt.hash(password, 12);
  db.prepare(`INSERT INTO users (id,name,email,password_hash,google_subject,picture,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(id,name,email,passwordHash,null,null,timestamp,timestamp);
  req.session.userId = id;
  res.status(201).json({ user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)) });
});
app.post('/api/auth/login', async (req,res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user?.password_hash || !(await bcrypt.compare(password,user.password_hash))) {
    return res.status(401).json({ error:'Email atau password salah.' });
  }
  req.session.userId = user.id;
  res.json({ user:publicUser(user) });
});
app.post('/api/auth/google', async (req,res) => {
  const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
  if (!credential) return res.status(400).json({ error:'Credential Google tidak tersedia.' });
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId || googleClientId.includes('REPLACE_WITH')) {
    return res.status(503).json({ error:'Login Google belum dikonfigurasi.' });
  }
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!response.ok) throw new Error('INVALID_GOOGLE_TOKEN');
    const profile = await response.json();
    if (profile.aud !== googleClientId || profile.email_verified !== 'true') throw new Error('INVALID_GOOGLE_TOKEN');
    const email = String(profile.email || '').trim().toLowerCase();
    if (!email) throw new Error('INVALID_GOOGLE_TOKEN');
    let user = db.prepare('SELECT * FROM users WHERE google_subject=? OR email=?').get(profile.sub,email);
    const timestamp = now();
    if (!user) {
      const id = `USR-${crypto.randomBytes(8).toString('hex')}`;
      db.prepare(`INSERT INTO users (id,name,email,password_hash,google_subject,picture,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?)`).run(id,profile.name || email.split('@')[0],email,null,profile.sub,profile.picture || null,timestamp,timestamp);
      user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    } else {
      db.prepare(`UPDATE users SET name=?,picture=?,google_subject=COALESCE(google_subject,?),updated_at=? WHERE id=?`)
        .run(profile.name || user.name,profile.picture || user.picture,profile.sub,timestamp,user.id);
      user = db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
    }
    req.session.userId = user.id;
    res.json({ user:publicUser(user) });
  } catch {
    res.status(401).json({ error:'Credential Google tidak valid.' });
  }
});
app.post('/api/auth/logout', (req,res) => {
  req.session.destroy(() => res.json({ ok:true }));
});
app.post('/api/joki-orders', (req,res) => {
  const body = req.body || {};
  const game = typeof body.game === 'string' ? body.game.trim() : '';
  const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
  const fromValue = Number(body.from_value);
  const toValue = Number(body.to_value);
  const rate = Number(body.rate_idr);
  const playerId = typeof body.player_id === 'string' ? body.player_id.trim() : '';
  const serverId = typeof body.server_id === 'string' ? body.server_id.trim() : '';
  const buyerContact = typeof body.buyer_contact === 'string' ? body.buyer_contact.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0,500) : '';

  if (!game || game.length > 60) return res.status(400).json({ error:'Game wajib dipilih.' });
  if (!unit || unit.length > 30) return res.status(400).json({ error:'Satuan joki wajib dipilih.' });
  if (!Number.isInteger(fromValue) || !Number.isInteger(toValue) || toValue < fromValue || toValue < 0) {
    return res.status(400).json({ error:'Rentang joki tidak valid.' });
  }
  if (!Number.isFinite(rate) || rate < 0) return res.status(400).json({ error:'Harga per satuan tidak valid.' });
  if (!playerId || playerId.length > 80) return res.status(400).json({ error:'ID pemain wajib diisi.' });
  if (serverId.length > 80) return res.status(400).json({ error:'Server ID tidak valid.' });
  if (buyerContact.length > 40) return res.status(400).json({ error:'Kontak tidak valid.' });

  const estimatedPrice = (toValue - fromValue) * rate;
  const id = `JK-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const timestamp = now();
  db.prepare(`INSERT INTO joki_orders
    (id,game,unit,from_value,to_value,rate_idr,estimated_price,player_id,server_id,buyer_contact,note,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id,game,unit,fromValue,toValue,rate,estimatedPrice,playerId,serverId||null,buyerContact||null,note||null,'waiting_confirmation',timestamp,timestamp);

  res.status(201).json({
    order: {
      id, game, unit, from_value:fromValue, to_value:toValue,
      rate_idr:rate, estimated_price:estimatedPrice,
      status:'waiting_confirmation', created_at:timestamp
    }
  });
});
app.get('/api/products', (_req,res) => {
  const rows = db.prepare('SELECT sku,game,name,currency,amount,price_idr FROM products WHERE active=1 ORDER BY game, amount').all();
  res.json({ products: rows });
});
app.post('/api/orders', (req,res) => {
  const { player_id, server_id='', buyer_contact='', sku, payment_method='online' } = req.body || {};
  if (typeof player_id !== 'string' || !/^[a-zA-Z0-9#][a-zA-Z0-9 _#.-]{2,39}$/.test(player_id.trim())) return res.status(400).json({ error:'ID pemain wajib diisi (3–40 karakter yang valid).' });
  if (typeof server_id !== 'string' || server_id.length > 40) return res.status(400).json({ error:'Server ID tidak valid.' });
  if (typeof buyer_contact !== 'string' || buyer_contact.length > 30) return res.status(400).json({ error:'Kontak tidak valid.' });
  const allowedMethods = ['online','qris','bank_transfer','bca','bca_va','dana','gopay'];
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

app.post('/api/webhooks/midtrans', (req, res) => {
  const n = req.body;

  // 1. Verifikasi bahwa notifikasi berasal dari Midtrans.
  if (!verifyMidtransNotification(n)) {
    return res.status(401).json({ error: 'Signature tidak valid.' });
  }

  // 2. Pastikan order ID valid dan pesanan memang ada.
  if (typeof n.order_id !== 'string' || !n.order_id) {
    return res.status(400).json({ error: 'Order ID tidak valid.' });
  }

  const order = db.prepare(
    'SELECT * FROM orders WHERE id=?'
  ).get(n.order_id);

  if (!order) {
    return res.status(404).json({
      error: 'Pesanan tidak ditemukan.'
    });
  }

  // 3. Validasi nominal sebelum event dicatat.
  const amount = Number(n.gross_amount);

  if (
    typeof n.gross_amount !== 'string' ||
    !Number.isFinite(amount) ||
    amount !== Number(order.price_idr)
  ) {
    return res.status(400).json({
      error: 'Nominal pembayaran tidak cocok.'
    });
  }

  const status = normalizePaymentStatus(n);

  // Jangan menerima status paid jika status code tidak sukses.
  if (status === 'paid' && n.status_code !== '200') {
    return res.status(400).json({
      error: 'Status kode pembayaran tidak valid.'
    });
  }

  // Hash event untuk mengenali pengiriman notifikasi yang sama.
  const eventKey = crypto
    .createHash('sha256')
    .update(JSON.stringify(n))
    .digest('hex');

  try {
    const processNotification = db.transaction(() => {
      const insert = db.prepare(`
        INSERT OR IGNORE INTO webhook_events
        (event_key, received_at)
        VALUES (?, ?)
      `).run(eventKey, now());

      if (!insert.changes) {
        return 'duplicate';
      }

      const current = db.prepare(
        'SELECT * FROM orders WHERE id=?'
      ).get(n.order_id);

      if (!current) {
        throw new Error('ORDER_NOT_FOUND');
      }

      const oldStatus = current.payment_status;
      let nextStatus = oldStatus;

      // Jangan biarkan notifikasi terlambat membatalkan pembayaran sah.
      if (oldStatus === 'refunded') {
        nextStatus = 'refunded';
      } else if (status === 'refunded') {
        nextStatus = 'refunded';
      } else if (oldStatus === 'paid') {
        nextStatus = 'paid';
      } else if (status === 'paid') {
        nextStatus = 'paid';
      } else if (status === 'failed') {
        nextStatus = 'failed';
      } else if (oldStatus !== 'failed') {
        nextStatus = 'pending';
      }

      const timestamp = now();

      db.prepare(`
        UPDATE orders
        SET payment_status=?, updated_at=?
        WHERE id=?
      `).run(nextStatus, timestamp, current.id);

      // Hanya pembayaran sah yang boleh masuk antrean.
      if (
        nextStatus === 'paid' &&
        current.fulfillment_status === 'waiting_payment'
      ) {
        db.prepare(`
          UPDATE orders
          SET fulfillment_status='queued', updated_at=?
          WHERE id=?
            AND fulfillment_status='waiting_payment'
        `).run(timestamp, current.id);
      }

      return 'processed';
    });

    const result = processNotification();

    return res.status(200).json({
      received: true,
      duplicate: result === 'duplicate'
    });
  } catch (e) {
    console.error('Midtrans webhook error:', e.message);

    return res.status(500).json({
      error: 'Notifikasi belum berhasil diproses.'
    });
  }
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
app.listen(port, '0.0.0.0', () => {
  console.log(`ANCA Store running on port ${port}`);
});
