/* ParkNest — database setup & seed (better-sqlite3) */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'parknest.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  society TEXT NOT NULL,
  city TEXT NOT NULL,
  slot_no TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'Car',
  ev INTEGER NOT NULL DEFAULT 0,
  covered INTEGER NOT NULL DEFAULT 1,
  price_hour INTEGER NOT NULL,
  price_month INTEGER NOT NULL,
  avail_from TEXT NOT NULL DEFAULT '09:00',
  avail_to TEXT NOT NULL DEFAULT '21:00',
  note TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  lat REAL,
  lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id INTEGER NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  parker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  hours INTEGER NOT NULL,
  vehicle_no TEXT NOT NULL,
  total INTEGER NOT NULL,
  owner_earning INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  pass_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/* ---------- migrations for pre-existing databases ---------- */
function ensureColumn(table, col, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn('slots', 'lat', 'lat REAL');
ensureColumn('slots', 'lng', 'lng REAL');
ensureColumn('bookings', 'pass_code', 'pass_code TEXT');
ensureColumn('users', 'role', "role TEXT NOT NULL DEFAULT 'user'");

/* ---------- shared helpers ---------- */
const PASS_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genPassCode() {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) code += PASS_ALPHABET[bytes[i] % PASS_ALPHABET.length];
  return 'PN-' + code;
}
const jitter = () => (Math.random() - 0.5) * 0.018;

/* approximate society locations (city areas) */
const SOCIETY_COORDS = {
  'Sunrise Society': [18.5074, 73.8077],   /* Kothrud, Pune */
  'Green Meadows': [18.5642, 73.7769],     /* Baner, Pune */
  'Skyline Heights': [19.1364, 72.8296],   /* Andheri West, Mumbai */
  'Palm Grove': [12.9698, 77.7500]         /* Whitefield, Bengaluru */
};

/* backfill pass codes for old rows */
const updPass = db.prepare('UPDATE bookings SET pass_code=? WHERE id=?');
db.prepare('SELECT id FROM bookings WHERE pass_code IS NULL').all()
  .forEach(r => updPass.run(genPassCode(), r.id));

/* backfill coordinates for old rows */
const updLL = db.prepare('UPDATE slots SET lat=?, lng=? WHERE id=?');
db.prepare('SELECT id, society, city FROM slots WHERE lat IS NULL').all()
  .forEach(r => {
    const c = SOCIETY_COORDS[r.society] || [18.5204, 73.8567];
    updLL.run(+(c[0] + jitter()).toFixed(5), +(c[1] + jitter()).toFixed(5), r.id);
  });

/* ---------- seed demo data (only when empty) ---------- */
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const hash = bcrypt.hashSync('demo1234', 10);
  const insUser = db.prepare('INSERT INTO users (name,email,phone,password_hash) VALUES (?,?,?,?)');
  const priya = insUser.run('Priya Sharma', 'priya@demo.in', '98765 43210', hash).lastInsertRowid;
  const arjun = insUser.run('Arjun Mehta', 'arjun@demo.in', '98220 11223', hash).lastInsertRowid;
  const demo = insUser.run('Demo User', 'demo@parknest.in', '99001 23456', hash).lastInsertRowid;
  const neha = insUser.run('Neha Kulkarni', 'neha@demo.in', '97400 55667', hash).lastInsertRowid;

  const insSlot = db.prepare(`INSERT INTO slots
    (owner_id,society,city,slot_no,vehicle_type,ev,covered,price_hour,price_month,avail_from,avail_to,note,lat,lng)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const pos = (soc, k) => {
    const c = SOCIETY_COORDS[soc] || [18.5204, 73.8567];
    return [+(c[0] + jitter() + k * 0.004).toFixed(5), +(c[1] + jitter() - k * 0.003).toFixed(5)];
  };

  const slots = [
    [priya,'Sunrise Society','Pune','B1-12','Car',1,1,50,3200,'08:00','21:00','Covered basement slot with EV charger, 2 min from main gate.', ...pos('Sunrise Society',0)],
    [priya,'Sunrise Society','Pune','B1-13','Car',0,1,40,2600,'09:00','19:00','Quiet corner spot next to lift lobby.', ...pos('Sunrise Society',1)],
    [priya,'Green Meadows','Pune','P2-07','Both',0,1,45,2900,'06:00','22:00','Podium slot, camera facing.', ...pos('Green Meadows',0)],
    [arjun,'Green Meadows','Pune','B1-21','Car',1,1,60,4200,'00:00','23:59','EV charging + 24x7 access. Perfect for IT park commuters.', ...pos('Green Meadows',1)],
    [arjun,'Skyline Heights','Mumbai','B2-04','Car',0,1,80,5400,'09:00','19:00','Andheri West, 5 min from metro station.', ...pos('Skyline Heights',0)],
    [arjun,'Skyline Heights','Mumbai','B2-05','Two-wheeler',0,1,25,1500,'00:00','23:59','Safe two-wheeler slot with guard on duty.', ...pos('Skyline Heights',1)],
    [neha,'Palm Grove','Bengaluru','B1-08','Car',1,1,70,4800,'07:00','21:00','Whitefield IT corridor. EV charger installed Jan 2026.', ...pos('Palm Grove',0)],
    [neha,'Palm Grove','Bengaluru','B1-09','Car',0,0,55,3500,'18:00','09:00','Overnight parking only. Open-air but guarded.', ...pos('Palm Grove',1)],
    [neha,'Palm Grove','Bengaluru','P1-02','Both',0,1,50,3100,'08:00','20:00','Visitor slot near clubhouse.', ...pos('Palm Grove',2)],
    [priya,'Sunrise Society','Pune','B1-14','Two-wheeler',0,1,20,1200,'09:00','19:00','Two-wheeler stand, covered.', ...pos('Sunrise Society',2)],
    [arjun,'Green Meadows','Pune','P2-11','Car',0,1,42,2700,'10:00','18:00','Weekday office-hours rental preferred.', ...pos('Green Meadows',2)],
    [neha,'Skyline Heights','Mumbai','B2-09','Car',1,1,90,6200,'00:00','23:59','Premium covered slot with EV charging, Andheri.', ...pos('Skyline Heights',2)]
  ];
  const slotIds = slots.map(s => insSlot.run(...s).lastInsertRowid);

  const insBooking = db.prepare(`INSERT INTO bookings
    (slot_id,parker_id,owner_id,date,start_time,hours,vehicle_no,total,owner_earning,status,pass_code)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const price = (slot, hours) => hours >= 720 ? slot.price_month + (slot.ev ? 300 : 0)
                                             : slot.price_hour * hours + (slot.ev ? 30 : 0);
  const day = d => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };

  const mk = (idx, parker, date, st, h, veh, status) => {
    const s = slots[idx];
    const total = price({ price_hour: s[7], price_month: s[8], ev: s[5] }, h);
    insBooking.run(slotIds[idx], parker, s[0], date, st, h, veh, total, Math.round(total * 0.85), status, genPassCode());
  };
  /* past (completed) + upcoming demo bookings */
  mk(1, demo, day(-21), '09:00', 720, 'MH 12 AB 3456', 'active');
  mk(3, demo, day(-40), '00:00', 720, 'MH 14 CD 7789', 'active');
  mk(2, neha, day(-7), '10:00', 4, 'MH 12 AB 3456', 'active');
  mk(6, demo, day(-3), '14:00', 2, 'KA 05 EF 1122', 'active');
  mk(3, neha, day(3), '00:00', 720, 'KA 03 GT 9091', 'active');
  mk(0, demo, day(1), '10:00', 4, 'MH 12 AB 3456', 'active');
  mk(11, demo, day(5), '09:00', 8, 'MH 04 PQ 3344', 'active');
}

/* ---------- admin account (ensured) ---------- */
if (!db.prepare(`SELECT id FROM users WHERE email = 'admin@parknest.in'`).get()) {
  db.prepare('INSERT INTO users (name,email,phone,password_hash,role) VALUES (?,?,?,?,?)')
    .run('ParkNest Admin', 'admin@parknest.in', '90000 00001', bcrypt.hashSync('admin1234', 10), 'admin');
}

/* ---------- notifications helper (plug email/SMS providers here) ---------- */
db.notify = (userId, type, title, body) =>
  db.prepare('INSERT INTO notifications (user_id,type,title,body) VALUES (?,?,?,?)').run(userId, type, title, body || '');

db.genPassCode = genPassCode;
module.exports = db;
