import Database from 'better-sqlite3';

const dbPath = process.env.DB_PATH || '/tmp/diamondku.sqlite';

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
}
