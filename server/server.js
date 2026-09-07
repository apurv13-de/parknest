/* ParkNest API + static host */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

/* ---------- helpers ---------- */
const newToken = () => crypto.randomBytes(24).toString('hex');
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role || 'user', created_at: u.created_at });
const firstName = n => (n || '').split(' ')[0];
const genPassCode = () => db.genPassCode();

/* approximate city centers for auto-pinning new listings */
const CITY_CENTERS = {
  Pune: [18.5204, 73.8567],
  Mumbai: [19.0760, 72.8777],
  Bengaluru: [12.9716, 77.5946],
  Other: [18.5204, 73.8567]
};
const pinJitter = v => +(v + (Math.random() - 0.5) * 0.024).toFixed(5);

function siteBase(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  const row = db.prepare('SELECT u.* , s.token FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token);
  if (!row) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  req.user = row; req.token = token;
  next();
}

const ts = (date, time) => new Date(`${date}T${time}:00`).getTime();
function hasOverlap(slotId, start, end, excludeBookingId = null) {
  const rows = db.prepare(`SELECT id, date, start_time, hours FROM bookings WHERE slot_id = ? AND status = 'active'`).all(slotId);
  return rows.some(b => {
    if (excludeBookingId && b.id === excludeBookingId) return false;
    const s = ts(b.date, b.start_time), e = s + b.hours * 3600e3;
    return start < e && end > s;
  });
}
function quote(slot, hours) {
  const total = hours >= 720
    ? slot.price_month + (slot.ev ? 300 : 0)
    : slot.price_hour * hours + (slot.ev ? 30 : 0);
  return { total, owner_earning: Math.round(total * 0.85) };
}
function passState(b) {
  if (b.status === 'cancelled') return 'cancelled';
  const s = ts(b.date, b.start_time), e = s + b.hours * 3600e3, now = Date.now();
  if (now < s) return 'upcoming';
  if (now > e) return 'expired';
  return 'active';
}

/* ---------- auth ---------- */
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
  const id = db.prepare('INSERT INTO users (name,email,phone,password_hash) VALUES (?,?,?,?)')
    .run(name.trim(), email.toLowerCase(), (phone || '').trim(), bcrypt.hashSync(String(password), 10)).lastInsertRowid;
  const token = newToken();
  db.prepare('INSERT INTO sessions (token,user_id) VALUES (?,?)').run(token, id);
  res.json({ token, user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash))
    return res.status(401).json({ error: 'Incorrect email or password.' });
  const token = newToken();
  db.prepare('INSERT INTO sessions (token,user_id) VALUES (?,?)').run(token, u.id);
  res.json({ token, user: publicUser(u) });
});

app.post('/api/auth/logout', auth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

/* ---------- public ---------- */
app.get('/api/stats', (req, res) => {
  const slots = db.prepare('SELECT COUNT(*) c FROM slots').get().c;
  const societies = db.prepare('SELECT COUNT(DISTINCT society) c FROM slots').get().c;
  const bookings = db.prepare(`SELECT COUNT(*) c FROM bookings`).get().c;
  const paid = db.prepare(`SELECT COALESCE(SUM(owner_earning),0) s FROM bookings WHERE status != 'cancelled'`).get().s;
  res.json({ slots: slots + 12400, societies: societies + 46, bookings, paid_out: paid });
});

app.get('/api/slots', (req, res) => {
  const { q = '', city = '', ev = '', vehicle = '', sort = '' } = req.query;
  let sql = `SELECT s.*, u.name AS owner_name FROM slots s JOIN users u ON u.id = s.owner_id WHERE s.active = 1`;
  const args = [];
  if (q) { sql += ` AND (s.society LIKE ? OR s.city LIKE ? OR s.slot_no LIKE ?)`; args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (city) { sql += ` AND s.city = ?`; args.push(city); }
  if (ev === '1') sql += ` AND s.ev = 1`;
  if (vehicle) { sql += ` AND (s.vehicle_type = ? OR s.vehicle_type = 'Both')`; args.push(vehicle); }
  if (sort === 'price_asc') sql += ` ORDER BY s.price_hour ASC`;
  else if (sort === 'price_desc') sql += ` ORDER BY s.price_hour DESC`;
  else sql += ` ORDER BY s.created_at DESC`;
  const rows = db.prepare(sql).all(...args).map(s => ({ ...s, owner_name: firstName(s.owner_name) }));
  res.json({ slots: rows });
});

/* ---------- slots (owner) ---------- */
const SLOT_TYPES = ['Car', 'Two-wheeler', 'Both'];

app.post('/api/slots', auth, (req, res) => {
  const { society, city, slot_no, vehicle_type, ev, covered, price_hour, price_month, avail_from, avail_to, note } = req.body || {};
  if (!society || !city || !slot_no) return res.status(400).json({ error: 'Society, city and slot number are required.' });
  if (!SLOT_TYPES.includes(vehicle_type)) return res.status(400).json({ error: 'Invalid vehicle type.' });
  const ph = parseInt(price_hour, 10), pm = parseInt(price_month, 10);
  if (!ph || ph < 5 || ph > 500) return res.status(400).json({ error: 'Hourly price must be between ₹5 and ₹500.' });
  if (!pm || pm < 500 || pm > 20000) return res.status(400).json({ error: 'Monthly price must be between ₹500 and ₹20,000.' });
  const center = CITY_CENTERS[city.trim()] || CITY_CENTERS.Other;
  const id = db.prepare(`INSERT INTO slots
    (owner_id,society,city,slot_no,vehicle_type,ev,covered,price_hour,price_month,avail_from,avail_to,note,lat,lng)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(req.user.id, society.trim(), city.trim(), slot_no.trim().toUpperCase(), vehicle_type,
         ev ? 1 : 0, covered === false ? 0 : 1, ph, pm,
         avail_from || '09:00', avail_to || '21:00', (note || '').trim(),
         pinJitter(center[0]), pinJitter(center[1])).lastInsertRowid;
  res.json({ slot: db.prepare('SELECT * FROM slots WHERE id=?').get(id) });
});

app.get('/api/slots/mine', auth, (req, res) => {
  const rows = db.prepare(`SELECT s.*,
      (SELECT COUNT(*) FROM bookings b WHERE b.slot_id = s.id AND b.status != 'cancelled') AS bookings_count,
      (SELECT COALESCE(SUM(owner_earning),0) FROM bookings b WHERE b.slot_id = s.id AND b.status != 'cancelled') AS earned
    FROM slots s WHERE s.owner_id = ? ORDER BY s.created_at DESC`).all(req.user.id);
  res.json({ slots: rows });
});

app.patch('/api/slots/:id', auth, (req, res) => {
  const slot = db.prepare('SELECT * FROM slots WHERE id=? AND owner_id=?').get(req.params.id, req.user.id);
  if (!slot) return res.status(404).json({ error: 'Slot not found.' });
  if (typeof req.body.active === 'boolean') {
    db.prepare('UPDATE slots SET active = ? WHERE id = ?').run(req.body.active ? 1 : 0, slot.id);
  }
  res.json({ slot: db.prepare('SELECT * FROM slots WHERE id=?').get(slot.id) });
});

app.delete('/api/slots/:id', auth, (req, res) => {
  const slot = db.prepare('SELECT * FROM slots WHERE id=? AND owner_id=?').get(req.params.id, req.user.id);
  if (!slot) return res.status(404).json({ error: 'Slot not found.' });
  const future = db.prepare(`SELECT COUNT(*) c FROM bookings WHERE slot_id=? AND status='active' AND (date || 'T' || start_time) > datetime('now')`).get(slot.id).c;
  if (future > 0) return res.status(409).json({ error: 'This slot has upcoming bookings. Pause it instead, or ask parkers to cancel first.' });
  db.prepare('DELETE FROM slots WHERE id=?').run(slot.id);
  res.json({ ok: true });
});

/* ---------- bookings ---------- */
app.post('/api/bookings', auth, (req, res) => {
  const { slot_id, date, start_time, hours, vehicle_no } = req.body || {};
  const h = parseInt(hours, 10);
  if (!slot_id || !date || !start_time || !h || !vehicle_no)
    return res.status(400).json({ error: 'Slot, date, time, duration and vehicle number are required.' });
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date.' });
  if (!/^[0-9]{2}:[0-9]{2}$/.test(start_time)) return res.status(400).json({ error: 'Invalid start time.' });
  if (![1, 2, 4, 8, 12, 24, 720].includes(h)) return res.status(400).json({ error: 'Invalid duration.' });

  const slot = db.prepare('SELECT * FROM slots WHERE id=?').get(slot_id);
  if (!slot || !slot.active) return res.status(404).json({ error: 'This slot is no longer available.' });

  const start = ts(date, start_time);
  if (isNaN(start)) return res.status(400).json({ error: 'Invalid date or time.' });
  if (start < Date.now() - 60e3) return res.status(400).json({ error: 'Booking time is in the past.' });
  if (hasOverlap(slot.id, start, start + h * 3600e3))
    return res.status(409).json({ error: 'Sorry, this slot was just booked for that time. Try another slot or timing.' });

  const { total, owner_earning } = quote(slot, h);
  const id = db.prepare(`INSERT INTO bookings (slot_id,parker_id,owner_id,date,start_time,hours,vehicle_no,total,owner_earning,pass_code)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(slot.id, req.user.id, slot.owner_id, date, start_time, h, vehicle_no.trim().toUpperCase(), total, owner_earning, genPassCode()).lastInsertRowid;
  const booking = db.prepare('SELECT * FROM bookings WHERE id=?').get(id);
  db.notify(slot.owner_id, 'booking', `New booking on ${slot.slot_no}`,
    `${firstName(req.user.name)} booked ${slot.slot_no} for ${booking.date} at ${booking.start_time} (${h}h). You earn ₹${owner_earning}.`);
  db.notify(req.user.id, 'booking', 'Booking confirmed',
    `Slot ${slot.slot_no} at ${slot.society} on ${booking.date}, ${booking.start_time}. Gate pass: ${booking.pass_code}`);
  res.json({ booking, slot: { society: slot.society, city: slot.city, slot_no: slot.slot_no } });
});

app.get('/api/bookings/mine', auth, (req, res) => {
  const rows = db.prepare(`SELECT b.*, s.society, s.city, s.slot_no, s.ev
    FROM bookings b JOIN slots s ON s.id = b.slot_id
    WHERE b.parker_id = ? ORDER BY b.date DESC, b.start_time DESC`).all(req.user.id);
  res.json({ bookings: rows });
});

app.get('/api/bookings/received', auth, (req, res) => {
  const rows = db.prepare(`SELECT b.*, s.society, s.city, s.slot_no, u.name AS parker_name
    FROM bookings b JOIN slots s ON s.id = b.slot_id JOIN users u ON u.id = b.parker_id
    WHERE b.owner_id = ? ORDER BY b.date DESC, b.start_time DESC`).all(req.user.id);
  rows.forEach(r => r.parker_name = firstName(r.parker_name));
  res.json({ bookings: rows });
});

app.post('/api/bookings/:id/cancel', auth, (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  if (b.parker_id !== req.user.id && b.owner_id !== req.user.id) return res.status(403).json({ error: 'Not your booking.' });
  if (b.status === 'cancelled') return res.status(409).json({ error: 'Booking is already cancelled.' });
  if (ts(b.date, b.start_time) < Date.now()) return res.status(409).json({ error: 'Past bookings cannot be cancelled.' });
  db.prepare(`UPDATE bookings SET status='cancelled' WHERE id=?`).run(b.id);
  const other = b.parker_id === req.user.id ? b.owner_id : b.parker_id;
  db.notify(other, 'cancel', 'Booking cancelled',
    `Booking on ${b.date} at ${b.start_time} was cancelled by ${firstName(req.user.name)}.`);
  res.json({ ok: true });
});

/* ---------- gate pass & QR ---------- */
app.get('/api/bookings/:id/pass', auth, (req, res) => {
  const b = db.prepare(`SELECT b.*, s.society, s.city, s.slot_no, s.ev, s.lat, s.lng
    FROM bookings b JOIN slots s ON s.id = b.slot_id WHERE b.id = ?`).get(req.params.id);
  if (!b || (b.parker_id !== req.user.id && b.owner_id !== req.user.id))
    return res.status(404).json({ error: 'Booking not found.' });
  const parker = db.prepare('SELECT name FROM users WHERE id = ?').get(b.parker_id);
  const owner = db.prepare('SELECT name FROM users WHERE id = ?').get(b.owner_id);
  const start = ts(b.date, b.start_time);
  res.json({
    booking: {
      id: b.id, pass_code: b.pass_code, status: b.status, state: passState(b),
      date: b.date, start_time: b.start_time, hours: b.hours,
      end_time: new Date(start + b.hours * 3600e3).toTimeString().slice(0, 5),
      vehicle_no: b.vehicle_no, total: b.total, owner_earning: b.owner_earning,
      society: b.society, city: b.city, slot_no: b.slot_no, ev: !!b.ev, lat: b.lat, lng: b.lng,
      parker: firstName(parker && parker.name), owner: firstName(owner && owner.name)
    }
  });
});

app.get('/api/bookings/:id/qr.svg', auth, async (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!b || (b.parker_id !== req.user.id && b.owner_id !== req.user.id))
    return res.status(404).json({ error: 'Booking not found.' });
  try {
    const url = `${siteBase(req)}/verify.html?code=${b.pass_code}`;
    const svg = await QRCode.toString(url, {
      type: 'svg', margin: 1, width: 220,
      color: { dark: '#12152b', light: '#ffffff' }
    });
    res.type('image/svg+xml').send(svg);
  } catch (e) {
    res.status(500).json({ error: 'Could not generate QR code.' });
  }
});

/* public gate-check for society security */
app.get('/api/pass/:code', (req, res) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  const b = db.prepare(`SELECT b.*, s.society, s.city, s.slot_no
    FROM bookings b JOIN slots s ON s.id = b.slot_id WHERE b.pass_code = ?`).get(code);
  if (!b) return res.status(404).json({ error: 'Pass not found.' });
  const parker = db.prepare('SELECT name FROM users WHERE id = ?').get(b.parker_id);
  res.json({
    pass: {
      pass_code: b.pass_code, state: passState(b),
      date: b.date, start_time: b.start_time, hours: b.hours,
      vehicle_no: b.vehicle_no, society: b.society, city: b.city,
      slot_no: b.slot_no, parker: firstName(parker && parker.name)
    }
  });
});

/* ---------- slot availability (time-slot picker) ---------- */
app.get('/api/slots/:id/availability', (req, res) => {
  const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(req.params.id);
  if (!slot) return res.status(404).json({ error: 'Slot not found.' });
  const date = String(req.query.date || '');
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) return res.status(400).json({ error: 'date=YYYY-MM-DD is required.' });
  const rows = db.prepare(`SELECT date, start_time, hours FROM bookings WHERE slot_id = ? AND status = 'active'`).all(slot.id);
  const busy = rows.map(b => {
    const s = ts(b.date, b.start_time);
    return { s, e: s + b.hours * 3600e3 };
  }).filter(x => !isNaN(x.s));
  res.json({ date, avail_from: slot.avail_from, avail_to: slot.avail_to, busy });
});

/* ---------- notifications ---------- */
app.get('/api/notifications', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id).c;
  res.json({ notifications: rows, unread });
});

app.post('/api/notifications/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

/* ---------- admin ---------- */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

app.get('/api/admin/stats', auth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const slots = db.prepare('SELECT COUNT(*) c FROM slots').get().c;
  const slotsActive = db.prepare('SELECT COUNT(*) c FROM slots WHERE active = 1').get().c;
  const bookings = db.prepare('SELECT COUNT(*) c FROM bookings').get().c;
  const gross = db.prepare(`SELECT COALESCE(SUM(total),0) s FROM bookings WHERE status != 'cancelled'`).get().s;
  const payouts = db.prepare(`SELECT COALESCE(SUM(owner_earning),0) s FROM bookings WHERE status != 'cancelled'`).get().s;
  res.json({ users, slots, slots_active: slotsActive, bookings, gross, platform_revenue: gross - payouts });
});

app.get('/api/admin/users', auth, requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
      (SELECT COUNT(*) FROM bookings b WHERE b.parker_id = u.id AND b.status != 'cancelled') AS trips,
      (SELECT COUNT(*) FROM slots s WHERE s.owner_id = u.id) AS listings
    FROM users u ORDER BY u.created_at DESC, u.id DESC`).all();
  res.json({ users: rows });
});

app.get('/api/admin/slots', auth, requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT s.*, u.name AS owner_name FROM slots s JOIN users u ON u.id = s.owner_id ORDER BY s.created_at DESC, s.id DESC`).all();
  res.json({ slots: rows });
});

app.get('/api/admin/bookings', auth, requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT b.*, s.society, s.slot_no,
      pk.name AS parker_name, ow.name AS owner_name
    FROM bookings b JOIN slots s ON s.id = b.slot_id
    JOIN users pk ON pk.id = b.parker_id JOIN users ow ON ow.id = b.owner_id
    ORDER BY b.created_at DESC, b.id DESC LIMIT 30`).all();
  res.json({ bookings: rows });
});

app.patch('/api/admin/slots/:id', auth, requireAdmin, (req, res) => {
  const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(req.params.id);
  if (!slot) return res.status(404).json({ error: 'Slot not found.' });
  if (typeof req.body.active === 'boolean') {
    db.prepare('UPDATE slots SET active = ? WHERE id = ?').run(req.body.active ? 1 : 0, slot.id);
    db.notify(slot.owner_id, 'info', `Listing ${slot.slot_no} ${req.body.active ? 'reactivated' : 'paused'}`,
      req.body.active ? 'Your listing is visible to parkers again.' : 'Your listing was paused by ParkNest admin. Contact support for details.');
  }
  res.json({ slot: db.prepare('SELECT * FROM slots WHERE id = ?').get(slot.id) });
});

app.post('/api/admin/bookings/:id/cancel', auth, requireAdmin, (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  if (b.status === 'cancelled') return res.status(409).json({ error: 'Already cancelled.' });
  db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(b.id);
  [b.parker_id, b.owner_id].forEach(uid =>
    db.notify(uid, 'cancel', 'Booking cancelled by admin',
      `Booking ${b.pass_code} (${b.date} ${b.start_time}) was cancelled by ParkNest support. Refunds, if applicable, are processed within 24 hrs.`));
  res.json({ ok: true });
});

/* ---------- dashboard summary ---------- */
app.get('/api/summary', auth, (req, res) => {
  const listings = db.prepare('SELECT COUNT(*) c FROM slots WHERE owner_id=?').get(req.user.id).c;
  const listingsActive = db.prepare('SELECT COUNT(*) c FROM slots WHERE owner_id=? AND active=1').get(req.user.id).c;
  const received = db.prepare(`SELECT COUNT(*) c FROM bookings WHERE owner_id=? AND status!='cancelled'`).get(req.user.id).c;
  const earned = db.prepare(`SELECT COALESCE(SUM(owner_earning),0) s FROM bookings WHERE owner_id=? AND status!='cancelled'`).get(req.user.id).s;
  const spent = db.prepare(`SELECT COALESCE(SUM(total),0) s FROM bookings WHERE parker_id=? AND status!='cancelled'`).get(req.user.id).s;
  const trips = db.prepare(`SELECT COUNT(*) c FROM bookings WHERE parker_id=? AND status!='cancelled'`).get(req.user.id).c;
  res.json({ listings, listings_active: listingsActive, received_bookings: received, earned, spent, trips });
});

/* ---------- static frontend ---------- */
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`ParkNest running on http://0.0.0.0:${PORT}`));
