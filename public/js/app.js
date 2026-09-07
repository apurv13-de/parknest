/* ============================================================
   ParkNest — shared app core (nav, api, ui helpers)
   ============================================================ */

/* ---------- SVG sprite (injected once) ---------- */
(function injectSprite(){
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('width','0'); svg.setAttribute('height','0');
  svg.style.position = 'absolute';
  svg.setAttribute('aria-hidden','true');
  svg.innerHTML = `
  <defs>
    <symbol id="i-parking" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M10 17V7h3.5a3 3 0 0 1 0 6H10"/></symbol>
    <symbol id="i-money" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></symbol>
    <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2"/></symbol>
    <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
    <symbol id="i-card" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></symbol>
    <symbol id="i-file" viewBox="0 0 24 24"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5z"/><path d="M14 2v5h5M9 13h6M9 17h4"/></symbol>
    <symbol id="i-tag" viewBox="0 0 24 24"><path d="M20.6 13.4L11 3H4v7l9.6 10.4a2 2 0 0 0 2.9 0l4.1-4.2a2 2 0 0 0 0-2.8z"/><circle cx="8" cy="8" r="1.5"/></symbol>
    <symbol id="i-phone" viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></symbol>
    <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9.5 12l2 2 3.5-4"/></symbol>
    <symbol id="i-zap" viewBox="0 0 24 24"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></symbol>
    <symbol id="i-video" viewBox="0 0 24 24"><rect x="2" y="7" width="13" height="10" rx="2"/><path d="M15 10.5l7-3.5v10l-7-3.5"/></symbol>
    <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5a3 3 0 0 1 0 6M18.5 14.8c1.8.7 2.5 2.4 2.5 4.2"/></symbol>
    <symbol id="i-car" viewBox="0 0 24 24"><path d="M5 16H3v-4l2-5h14l2 5v4h-2"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/><path d="M9.3 16.5h5.4M5 11.5h14"/></symbol>
    <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></symbol>
    <symbol id="i-chart" viewBox="0 0 24 24"><path d="M3 21h18M6 21V12M12 21V5M18 21v-6"/></symbol>
    <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></symbol>
    <symbol id="i-inbox" viewBox="0 0 24 24"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/></symbol>
    <symbol id="i-bell" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></symbol>
  </defs>`;
  document.addEventListener('DOMContentLoaded', () => document.body.prepend(svg));
})();

/* ---------- API client ---------- */
const API = window.PARKNEST_API_BASE || '/api';
const store = {
  get token(){ return localStorage.getItem('pn_token') || ''; },
  set token(v){ v ? localStorage.setItem('pn_token', v) : localStorage.removeItem('pn_token'); },
  get user(){ try { return JSON.parse(localStorage.getItem('pn_user') || 'null'); } catch { return null; } },
  set user(v){ v ? localStorage.setItem('pn_user', JSON.stringify(v)) : localStorage.removeItem('pn_user'); }
};

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (store.token) headers.Authorization = 'Bearer ' + store.token;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong. Please try again.');
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------- auth helpers ---------- */
async function refreshUser() {
  if (!store.token) return null;
  try { const { user } = await api('/auth/me'); store.user = user; return user; }
  catch (e) { if (e.status === 401) logout(true); return null; }
}
function logout(silent) {
  const t = store.token;
  store.token = ''; store.user = '';
  if (t && !silent) api('/auth/logout', { method: 'POST' }).catch(() => {});
  if (!silent) { toast('Signed out. See you soon!'); setTimeout(() => location.href = 'index.html', 600); }
  else renderNavAuth();
}
function requireAuth() {
  if (store.token) return true;
  const next = encodeURIComponent(location.pathname.split('/').pop() || 'index.html');
  location.href = 'login.html?next=' + next;
  return false;
}

/* ---------- nav ---------- */
function initials(name){ return (name||'U').split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase(); }

function renderNavAuth() {
  const slot = document.getElementById('navAuth');
  if (!slot) return;
  const links = document.getElementById('navLinks');
  if (store.token && store.user) {
    if (links) {
      const existing = links.querySelector('a[href="admin.html"]');
      if (store.user.role === 'admin' && !existing) links.insertAdjacentHTML('beforeend', '<a href="admin.html">Admin</a>');
      if (store.user.role !== 'admin' && existing) existing.remove();
    }
    slot.innerHTML = `
      <div class="bell-wrap">
        <button class="bell-btn" id="bellBtn" aria-label="Notifications">
          <svg class="ic-svg"><use href="#i-bell"/></svg>
          <span class="bell-badge hidden" id="bellBadge"></span>
        </button>
        <div class="bell-panel hidden" id="bellPanel">
          <div class="bell-head">Notifications <button id="markReadBtn" type="button">Mark all read</button></div>
          <div class="bell-list" id="bellList"><div class="loading" style="padding:22px">Loading…</div></div>
        </div>
      </div>
      <a class="user-chip" href="dashboard.html" title="Go to dashboard">
        <span class="ava">${initials(store.user.name)}</span>${store.user.name.split(' ')[0]}
      </a>
      <button class="btn btn-ghost btn-sm" id="logoutBtn">Sign out</button>`;
    const b = document.getElementById('logoutBtn');
    if (b) b.addEventListener('click', () => logout());
    refreshBellBadge();
  } else {
    if (links) { const a = links.querySelector('a[href="admin.html"]'); if (a) a.remove(); }
    slot.innerHTML = `
      <a href="login.html" class="btn btn-ghost btn-sm">Sign in</a>
      <a href="login.html?mode=signup" class="btn btn-primary btn-sm">Get started</a>`;
  }
}

/* ---------- notifications bell ---------- */
async function refreshBellBadge() {
  if (!store.token) return;
  try {
    const { unread } = await api('/notifications');
    const badge = document.getElementById('bellBadge');
    if (!badge) return;
    badge.textContent = unread > 99 ? '99+' : unread;
    badge.classList.toggle('hidden', !unread);
  } catch {}
}
function notifTime(sqlUtc) {
  const d = new Date(String(sqlUtc).replace(' ', 'T') + 'Z');
  if (isNaN(d)) return '';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
async function loadNotifications() {
  const list = document.getElementById('bellList');
  if (!list) return;
  try {
    const { notifications } = await api('/notifications');
    list.innerHTML = notifications.length ? notifications.map(n => `
      <div class="notif ${n.read ? 'read' : ''}">
        <span class="n-dot"></span>
        <div><b>${esc(n.title)}</b><p>${esc(n.body || '')}</p></div>
        <span class="n-time">${notifTime(n.created_at)}</span>
      </div>`).join('')
      : '<p style="padding:20px;text-align:center;color:var(--muted);font-size:.88rem">No notifications yet.<br>Book a slot or list your spot to get started.</p>';
  } catch (e) {
    list.innerHTML = `<p style="padding:20px;text-align:center;color:var(--muted);font-size:.88rem">${esc(e.message)}</p>`;
  }
  refreshBellBadge();
}
document.addEventListener('click', async e => {
  const panel = document.getElementById('bellPanel');
  if (!panel) return;
  if (e.target.closest('#bellBtn')) {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) loadNotifications();
    return;
  }
  if (e.target.closest('#markReadBtn')) {
    try { await api('/notifications/read-all', { method: 'POST' }); loadNotifications(); } catch {}
    return;
  }
  if (!e.target.closest('.bell-panel')) panel.classList.add('hidden');
});
setInterval(refreshBellBadge, 60000);

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
}

/* ---------- modal ---------- */
function openModal(id) { const m = document.getElementById(id); if (m) m.classList.add('open'); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('open'); }

/* ---------- misc UI ---------- */
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
async function apiRaw(path) {
  const headers = {};
  if (store.token) headers.Authorization = 'Bearer ' + store.token;
  const res = await fetch(API + path, { headers });
  if (!res.ok) {
    let msg = 'Request failed.';
    try { msg = (await res.json()).error || msg; } catch {}
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return res.text();
}

/* lazy external loaders (used for the Leaflet map) */
function loadCSS(href) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}
function ensureLeaflet() {
  if (window.L) return Promise.resolve();
  if (!ensureLeaflet._p) {
    loadCSS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    ensureLeaflet._p = loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
  }
  return ensureLeaflet._p;
}
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
function time12(t) {
  let [h, m] = (t || '').split(':').map(Number);
  if (isNaN(h)) return t || '';
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m || 0).padStart(2, '0')} ${ap}`;
}
function fmtDay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function hoursLabel(h) { return h >= 720 ? 'Monthly' : (h >= 24 ? (h/24) + ' day' + (h>=48?'s':'') : h + ' hr' + (h>1?'s':'')); }
function bookingState(b) {
  if (b.status === 'cancelled') return ['st-cancelled', 'Cancelled'];
  const start = new Date(b.date + 'T' + b.start_time + ':00').getTime();
  const end = start + b.hours * 3600e3;
  if (end < Date.now()) return ['st-past', 'Completed'];
  if (start > Date.now()) return ['st-upcoming', 'Upcoming'];
  return ['st-active', 'Active now'];
}

/* ---------- background particles ---------- */
function spawnParticles() {
  const wrap = document.getElementById('particles');
  if (!wrap) return;
  const n = window.innerWidth < 600 ? 22 : 38;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    const size = 2 + Math.random() * 4;
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    s.style.left = Math.random() * 100 + '%';
    s.style.animationDuration = (9 + Math.random() * 16) + 's';
    s.style.animationDelay = (-Math.random() * 20) + 's';
    s.style.opacity = .15 + Math.random() * .4;
    wrap.appendChild(s);
  }
}

/* ---------- reveal + counters ---------- */
function setupReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}
function animateCounter(el, target, { prefix = '', suffix = '', divide = 1 } = {}) {
  const t0 = performance.now(), dur = 1600;
  function tick(t) {
    const p = Math.min((t - t0) / dur, 1), ease = 1 - Math.pow(1 - p, 3), val = target * ease;
    el.textContent = prefix + (divide === 1 ? Math.round(val).toLocaleString('en-IN') : (val / divide).toFixed(1)) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
function setupCounters() {
  const cio = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      animateCounter(e.target, +e.target.dataset.count, {
        prefix: e.target.dataset.prefix || '', suffix: e.target.dataset.suffix || '', divide: +(e.target.dataset.divide || 1)
      });
    });
  }, { threshold: .5 });
  document.querySelectorAll('.num[data-count]').forEach(el => cio.observe(el));
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  spawnParticles();
  setupReveal();
  setupCounters();
  renderNavAuth();
  refreshUser().then(() => renderNavAuth());

  const navbar = document.getElementById('navbar');
  if (navbar) window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 10), { passive: true });
  const burger = document.getElementById('burger');
  const links = document.getElementById('navLinks');
  if (burger && links) {
    burger.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  }
  const y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
});
