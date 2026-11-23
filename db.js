import Database from 'better-sqlite3';

const dbPath = process.env.DB_PATH || '/tmp/ancastore.sqlite';

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  google_subject TEXT UNIQUE,
  picture TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  sku TEXT PRIMARY KEY, game TEXT NOT NULL, name TEXT NOT NULL,
  currency TEXT NOT NULL, amount INTEGER NOT NULL, price_idr INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, player_id TEXT NOT NULL, server_id TEXT,
  buyer_contact TEXT, sku TEXT NOT NULL, game TEXT NOT NULL,
  product_name TEXT NOT NULL, amount INTEGER NOT NULL, price_idr INTEGER NOT NULL,
  payment_method TEXT NOT NULL, payment_status TEXT NOT NULL DEFAULT 'pending',
  fulfillment_status TEXT NOT NULL DEFAULT 'waiting_payment',
  provider_ref TEXT, payment_ref TEXT, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, FOREIGN KEY(sku) REFERENCES products(sku)
);
CREATE TABLE IF NOT EXISTS webhook_events (
  event_key TEXT PRIMARY KEY, received_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS joki_orders (
  id TEXT PRIMARY KEY,
  game TEXT NOT NULL,
  unit TEXT NOT NULL,
  from_value INTEGER NOT NULL,
  to_value INTEGER NOT NULL,
  rate_idr INTEGER NOT NULL,
  estimated_price INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  server_id TEXT,
  buyer_contact TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'waiting_confirmation',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
if (!count) {
  const seed = db.prepare('INSERT INTO products (sku,game,name,currency,amount,price_idr) VALUES (?,?,?,?,?,?)');
  const products = [
    ['ml-86','Mobile Legends','86 Diamonds','Diamond',86,20000],['ml-172','Mobile Legends','172 Diamonds','Diamond',172,39000],['ml-257','Mobile Legends','257 Diamonds','Diamond',257,57000],
    ['ff-70','Free Fire','70 Diamonds','Diamond',70,10000],['ff-140','Free Fire','140 Diamonds','Diamond',140,20000],['ff-355','Free Fire','355 Diamonds','Diamond',355,50000],
    ['pubg-60','PUBG Mobile','60 UC','UC',60,16000],['pubg-325','PUBG Mobile','325 UC','UC',325,79000],['pubg-660','PUBG Mobile','660 UC','UC',660,155000],
    ['genshin-60','Genshin Impact','60 Genesis Crystals','Genesis Crystals',60,16000],['valorant-125','Valorant','125 VP','VP',125,16000],
    ['hok-80','Honor of Kings','80 Tokens','Tokens',80,15000],['codm-80','Call of Duty: Mobile','80 CP','CP',80,16000]
  ];
  const tx = db.transaction(rows => rows.forEach(p => seed.run(...p)));
  tx(products);
};
const response = await fetch(`https://vip-reseller.co.id/api/game-feature', {

        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: param.toString()
    });

    cost data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('VIP Reseller service error:', err);
    return res.status(502).json({ 
    error: 'Gagal mengambil daftar layanan dari VIP Reseller.',
      });
  }
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
  const id = `, DK - $, { Date,: .now() } - $, { crypto,: .randomBytes(3).toString('hex').toUpperCase() } `;
  const timestamp = now();
  db.prepare(`, INSERT, INTO, orders(id, player_id, server_id, buyer_contact, sku, game, product_name, amount, price_idr, payment_method, created_at, updated_at),
  VALUES()`).run(id,player_id.trim(),server_id.trim()||null,buyer_contact.trim()||null,product.sku,product.game,product.name,product.amount,product.price_idr,payment_method,timestamp,timestamp);
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
      const insert = db.prepare(`,
  INSERT, OR, IGNORE, INTO, webhook_events(event_key, received_at),
  VALUES()`).run(eventKey, now());

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

      db.prepare(`,
  UPDATE, orders,
  SET, payment_status = ? : , updated_at = ?
    WHERE : , id = ?
      `).run(nextStatus, timestamp, current.id);

      // Hanya pembayaran sah yang boleh masuk antrean.
      if (
        nextStatus === 'paid' &&
        current.fulfillment_status === 'waiting_payment'
      ) {
        db.prepare(`
      :
  ,
  UPDATE, orders,
  SET, fulfillment_status = 'queued', updated_at = ?
    WHERE : , id = ?
      AND : , fulfillment_status = 'waiting_payment' `).run(timestamp, current.id);
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
  console.log(`, ANCA, Store, running, on, port, $, { port } `);
});
`);
