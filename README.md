# ParkNest — Society Parking Rental Platform

A full-stack marketplace where apartment owners rent out idle parking slots and drivers book verified slots inside societies — hourly, nightly or monthly.

**Stack:** HTML/CSS/JS frontend (no framework) · Node.js + Express · SQLite (better-sqlite3) · bcrypt auth with session tokens

---

## Features

| Parkers | Owners |
|---|---|
| Browse & filter slots (area, city, EV, vehicle, price sort) | List a spot in 2 minutes with pricing controls |
| Book hourly (1–24h) or monthly, with live conflict detection | Pause / resume / delete listings |
| Login / signup with secure session tokens | See bookings received + per-slot earnings |
| Cancel upcoming bookings | Earnings summary (85% payout per booking) |
| Dashboard with trips & spend | 24-hr payout tracking |
| **QR gate pass** per booking (printable, with map link) | **Verify any pass** via the public gate-check page |
| **Map view** of all slots (OpenStreetMap + Leaflet) | Pass codes shown on bookings received |
| **Live availability picker** — 24-hour strip per slot | **Notifications** — bell with unread badge |
| **Admin panel** — platform stats, users, listings, force-actions | |

Plus: animated background (drifting orbs + particles), editorial serif typography (Playfair Display + Outfit), lime marker section labels, fully responsive, reduced-motion support.

### Admin panel
Sign in as **`admin@parknest.in` / `admin1234`** — an **Admin** link appears in the nav. `admin.html` shows platform stats (users, active slots, bookings, gross volume, platform revenue), latest bookings (with force-cancel), all listings (pause/resume any), and all users. Regular users get 403 from every `/api/admin/*` endpoint.

### Availability picker
When booking, a 24-hour strip shows that day's availability for the slot: free hours (blue), already-booked hours (red), hours that conflict with your selected duration (amber), and hours outside the owner's window or in the past (gray). Click any free hour to set your start time — the server still double-checks overlaps.

### Notifications
An in-app bell with unread badge. Owners get notified on new bookings; parkers get confirmation (with pass code) and cancellation notices; both parties are notified on admin actions. Emit new types anywhere via `db.notify(userId, type, title, body)` — wire an email/SMS provider (SendGrid, Twilio, etc.) inside that helper to also push externally.

**Demo accounts:** `demo@parknest.in` / `demo1234` (owner + parker) · `admin@parknest.in` / `admin1234` (admin).

### Gate passes & verification (how it works)
1. Every confirmed booking gets a unique pass code (`PN-XXXXXXXX`).
2. The driver opens **Gate pass** from the dashboard (or right after booking) → a printable pass with a QR code.
3. The QR encodes a link to `/verify.html?code=PN-XXXX`. Society security scans it (or types the code at `/verify.html`) and instantly sees **VALID — entry allowed** / **not started** / **expired** / **cancelled**, with vehicle, slot and time window.
4. The verification endpoint (`GET /api/pass/:code`) is public — no login needed at the gate. Owners also see pass codes for bookings on their slots.

### Maps
Browse slots has a **List / Map** toggle. The map uses Leaflet + OpenStreetMap tiles (loaded from unpkg CDN — no API key). Markers are pinned per society area (EV slots get green markers); popups include price and a Book button. The map needs internet access; the list view works fully offline.

**Demo account:** `demo@parknest.in` / `demo1234` (comes pre-seeded with listings & bookings).

---

## Project structure

```
parknest/
├── public/                  ← frontend (static, GitHub-Pages-ready)
│   ├── index.html           ← landing page
│   ├── browse.html          ← search, filter, map view & booking
│   ├── list.html            ← list your spot + earnings estimator
│   ├── dashboard.html       ← owner/parker dashboard
│   ├── admin.html           ← admin panel (role-gated)
│   ├── pass.html            ← printable QR gate pass
│   ├── verify.html          ← public gate-check for society security
│   ├── login.html           ← sign in / create account
│   ├── css/style.css        ← shared design system
│   └── js/                  ← config.js (API URL) + app.js (core)
├── server/                  ← backend
│   ├── server.js            ← Express app + REST API
│   ├── db.js                ← SQLite schema + demo seed
│   └── package.json
├── .github/workflows/pages.yml  ← auto-deploy frontend to GitHub Pages
├── render.yaml              ← one-click API deploy on Render.com
└── README.md
```

---

## Run locally

Requires Node 18+.

```bash
cd server
npm install
npm start
```

Open **http://localhost:4000** — the Express server hosts both the API (`/api/*`) and the frontend. The database file is created and seeded automatically at `server/data/parknest.db`.

---

## Push to GitHub

**Double-click way (Mac):** run `push-to-github.command` — it walks you through creating the repo and pushing, including sign-in help.

**Terminal way:**

```bash
cd parknest
git init
git add .
git commit -m "ParkNest — society parking rental platform"
git branch -M main
git remote add origin https://github.com/YOURNAME/parknest.git
git push -u origin main
```

Or use [GitHub Desktop](https://desktop.github.com): File → Add Local Repository → select the `parknest` folder → Publish.

> `node_modules/` and the SQLite database are already git-ignored — they never get pushed.

---

## Deploy

### Option A — everything on Render (simplest, one URL)

1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com) → **New → Blueprint** → select the repo. `render.yaml` is auto-detected.
3. Done. Render serves the API **and** the whole site from one URL. No config changes needed.

> Note: Render's free tier uses an ephemeral disk — the SQLite DB resets occasionally. That's fine for a demo; use a paid disk or a hosted DB for production.

### Option B — frontend on GitHub Pages + API on Render (your setup)

**1. Deploy the API on Render** (same as Option A steps 1–2). Note your URL, e.g. `https://parknest-api.onrender.com`.

**2. Point the frontend at it** — edit `public/js/config.js`:

```js
window.PARKNEST_API_BASE = "https://parknest-api.onrender.com/api";
```

**3. Deploy the frontend to GitHub Pages:**

- Push the repo to GitHub (the included workflow deploys `public/` automatically).
- In the repo: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
- Your site goes live at `https://<username>.github.io/<repo>/`.

**4. CORS is already enabled** on the API, so the GitHub Pages site can call it directly.

> Free Render instances sleep after ~15 min idle; the first request afterwards takes ~30–60s to wake.

---

## API reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account → `{token, user}` |
| POST | `/api/auth/login` | — | Sign in → `{token, user}` |
| POST | `/api/auth/logout` | ✓ | Invalidate session |
| GET | `/api/auth/me` | ✓ | Current user |
| GET | `/api/stats` | — | Public counters |
| GET | `/api/slots` | — | List/filter slots (`?q=&city=&ev=1&vehicle=&sort=`) |
| POST | `/api/slots` | ✓ | Create listing |
| GET | `/api/slots/mine` | ✓ | My listings + earnings |
| PATCH | `/api/slots/:id` | ✓ | Pause / resume (`{active: bool}`) |
| DELETE | `/api/slots/:id` | ✓ | Delete (blocked if upcoming bookings) |
| POST | `/api/bookings` | ✓ | Book a slot (overlap-checked) |
| GET | `/api/bookings/mine` | ✓ | My trips |
| GET | `/api/bookings/received` | ✓ | Bookings on my slots |
| POST | `/api/bookings/:id/cancel` | ✓ | Cancel an upcoming booking |
| GET | `/api/bookings/:id/pass` | ✓ | Gate-pass details (parker or owner) |
| GET | `/api/bookings/:id/qr.svg` | ✓ | QR code SVG for the gate pass |
| GET | `/api/pass/:code` | — | **Public** gate verification for security |
| GET | `/api/slots/:id/availability?date=` | — | Busy intervals for the booking picker |
| GET | `/api/notifications` | ✓ | Latest notifications + unread count |
| POST | `/api/notifications/read-all` | ✓ | Mark all notifications read |
| GET | `/api/admin/stats` | admin | Platform totals & revenue |
| GET | `/api/admin/users` | admin | All users |
| GET | `/api/admin/slots` | admin | All listings (incl. paused) |
| GET | `/api/admin/bookings` | admin | Latest 30 bookings |
| PATCH | `/api/admin/slots/:id` | admin | Force pause / resume |
| POST | `/api/admin/bookings/:id/cancel` | admin | Force cancel + notify parties |
| GET | `/api/summary` | ✓ | Dashboard aggregates |

Pricing: hourly bookings = `price_hour × hours` (EV +₹30); monthly = `price_month` (EV +₹300). Owners earn 85%.

---

## Troubleshooting

- **"Could not reach the API" on the site** → the frontend can't reach the backend. If hosted on GitHub Pages, set the Render URL in `public/js/config.js`. Locally, make sure `npm start` is running in `/server`.
- **Slot shows unavailable / booking conflict** → someone booked that window first (real overlap checking is working as intended).
- **Reset demo data** → delete `server/data/parknest.db*` and restart the server.
