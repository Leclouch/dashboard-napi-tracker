@AGENTS.md

# Gelang GPS dashboard (dashboard-napi-tracker)

Frontend for the GPS bracelet backend in `../backend-napi-tracker` (read its CLAUDE.md for the
domain: zones, tiers, alert episodes, assignments). The developer is a student learning this stack,
so explain what you change and why.

## Decisions (already made)
- Next.js 16 App Router, TypeScript, Tailwind 4, react-leaflet 5 + Leaflet 1.9.4, socket.io-client
  (same version as the backend's socket.io). Ask before adding other dependencies.
- UI text in Bahasa Indonesia; code and comments in English. Times shown in WIB (Asia/Jakarta).
- Everything runs in the browser: the page is a client component tree; the browser calls the
  backend directly (NEXT_PUBLIC_API_URL, backend CORS_ORIGINS must list this origin). In production
  that is app.<domain> calling api.<domain>, which must share a domain: the cookie is SameSite=Strict.
- Login is staff accounts (backend CLAUDE.md, "Staff accounts"): an httpOnly cookie page code can't
  read, so `src/lib/session.ts` asks GET /auth/me and exposes the answer as a small store read with
  useSyncExternalStore. Never treat a failed check as logged out: only a 401 is. `/undangan` and
  `/atur-sandi` (App's OPEN_PAGES) open without a login and read their token from the URL's #.
- A session that ends on its own shows the login page with a notice that the alarm has stopped.
  The menu behind the logout button shows who is logged in, for shift handovers.
- `/akun` is superadmin only and hidden from staff in the navbar; the backend enforces it.
- Data flow (`src/lib/use-live-data.ts`): load zones, latest fixes, open alerts and open assignments
  over REST on every (re)connect, then apply /live events (fix, episode, alert_acknowledged,
  assignment). A REST snapshot never replaces a newer pushed fix. A connected socket renews the
  login; when the server refuses or hangs up, Socket.IO doesn't retry, so the hook does.
- Leaflet only in `src/components/MapView.tsx`, loaded with next/dynamic `ssr: false`.
  GeoJSON is [lng, lat]; Leaflet is [lat, lng]; convert only in ringToLatLngs.
- Response types in `src/lib/types.ts` mirror the backend; update both together.
- App structure: `AppShell` sits above all pages (mounted by `App` in the root layout) and owns the
  map, live data, alarm and selection, shared through `useShell()` (`src/lib/live-context.ts`). Pages
  only add a sheet over the map, so status and alerts stay visible and the map keeps its view.
- Look: Gojek-inspired layout and shapes, plain serious wording, no illustrations, not its branding.
  Brand blue #0046a8 matches Gojek green's saturation and lightness; keep it off the map, because
  blue isn't a status. Warn dots use amber #fbbf24, text keeps the darker amber.
- Status display: `src/lib/status.ts` holds the pure rules (open episode beats latest fix, tally, the
  card headline; offline or failed data always beats a calm headline). Every status is a circle
  (`src/lib/glyph.ts`, `.status-dot` in globals.css), shared by the lists and the map. Faster
  means more urgent: green breathes slowly, yellow faster, red fastest with a ring closing in; grey
  signal-lost has a ring spreading and fading. Not handed out: small, pale, still. Only the map
  animates; lists and alert cards show still circles. With reduced motion the rings hold still, so red and grey stay distinct.
  The status card fills red only for an unacknowledged out-of-zone alert.
- Trail of the selected bracelet (`use-trail.ts`, `trail.ts`): last 1, 2 or 4 h (default 1 h, chosen in
  `TrailRange` on the map; 4 h is the most the backend's 5000 points per bracelet hold at a 3 s interval)
  from GET /fixes/trails, then each live fix appended. Drawn in MapView as lines plus a small dot per reported position (hover shows the
  time), coloured by status and fading with age; GPS jitter under 3 m is thinned out. Only the selected
  bracelet gets one.
- Data master (`/data-master`, `DataMasterSheet.tsx`): warga binaan and petugas tabs, open to all staff.
  Add (a name that already exists only asks "Tetap tambahkan", it never refuses: two people can share
  a name), rename, deactivate, reactivate. People are never deleted: assignments, alerts and the audit
  log point at them. Deactivating is refused while someone has an open assignment (the backend
  answers 409; the page hides the button and links to Penugasan). Bracelets stay in /admin
  (superadmin only; adding one needs the firmware config and a manual EMQX user).
- Navbar items without an href show as "Segera" (`src/components/NavBar.tsx`); add the href when
  the page exists.
- Alarm (`src/lib/use-alarm.ts`): Web Audio beep, no sound file. Alert and signal_lost repeat every
  15 s until acknowledged, warn sounds once. If the browser blocks audio the header says so.
- Inmate names stay off the map (side panel only) until the facility approves, like Telegram's
  TELEGRAM_INCLUDE_NAMES. Font: Plus Jakarta Sans.
- Restart `npm run dev` after editing `globals.css`: with the custom Tailwind loader in
  next.config.ts, the dev server keeps serving the old stylesheet (seen 2026-11-02). If new styles
  are missing or white text disappears, check this first.
- Dev port 3001 (backend is 3000). `turbopack.root` is pinned because of a stray D:\yarn.lock.
- Production: `Dockerfile` (output: "standalone"), run by the backend's docker-compose.yml.
  NEXT_PUBLIC_API_URL is baked in at build time, so changing it means rebuilding the image.

## Rules
- Run `npx tsc --noEmit`, `npm run lint` and `npm run build` before finishing a change.
- Never commit `.env.local`; keep `.env.example` current.
- The user commits themselves; leave changes uncommitted.
