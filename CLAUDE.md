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
  GeoJSON is [lng, lat]; Leaflet is [lat, lng]; convert only in ringToLatLngs and, for a click or a
  dragged zone corner going back, latLngToCorner.
- Response types in `src/lib/types.ts` mirror the backend; update both together.
- App structure: `AppShell` sits above all pages (mounted by `App` in the root layout) and owns the
  map, live data, alarm and selection, shared through `useShell()` (`src/lib/live-context.ts`). Pages
  only add a sheet over the map, so status and alerts stay visible and the map keeps its view.
- Look: Gojek-inspired layout and shapes, plain serious wording, no illustrations, not its branding.
  Brand blue is #005de0 (hover #004cb8), made lighter than the original #0046a8 on 2026-11-14; it
  was chosen as the lightest that keeps AA contrast for blue text on the selected-row tint (4.9:1).
  Keep it off the map, because blue isn't a status. Warn dots use amber #fbbf24, text keeps the darker amber.
  The zone outline is violet #c026d3 with a white halo (MapView `ZONE_COLOR`): grey and green vanish
  into satellite terrain, and the status colours and blue are taken.
  Buttons and the bars that hold them use `.squircle` (globals.css: 14 px radius plus `corner-shape:
  squircle`, which only Chromium 139+ draws as a true squircle; elsewhere it is a plain rounded
  corner). A bar around buttons sets `--squircle` to the button radius plus its padding. Only dots,
  the grab bar and count badges stay fully round. Inputs are still `rounded-xl`.
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
- Data master (`/data-master`, `DataMasterSheet.tsx`): tabs Warga binaan, Petugas, Gelang, Zona.
  People (open to all staff): add (a name that already exists only asks "Tetap tambahkan", it never
  refuses: two people can share a name), rename, deactivate, reactivate. Nothing is ever deleted:
  assignments, fixes, alerts and the audit log point at it. Deactivating anything is refused while it
  has an open assignment (the backend answers 409; the page hides the button and links to Penugasan).
  Shared styles and `errorText` are in `data-master-ui.ts`.
- Gelang tab (`BraceletsTab.tsx`): everyone sees the list; a superadmin adds (shows the config.h to copy
  plus the EMQX checklist; the broker user is still made by hand), sees the config.h again, retires and
  reactivates. No rename: the label is the MQTT topic and the EMQX username in the firmware.
- Zona tab (`ZonesTab.tsx`): every officer adds and edits zones (name, both distances, the outline;
  decided 2026-11-20, the audit log names who changed what); only a superadmin retires and
  reactivates one. Every change is also posted to the staff Telegram group by the backend, with a
  warning when the zone became more lenient; the page says so before saving. Each row shows the area. The outline is drawn on the shared map: the draft (`src/lib/zone-draft.ts`,
  pure: corners [lng, lat], open ring, undo history) lives in the shell (`zoneDraft`), because MapView
  draws it. A click adds a corner into the nearest edge, a corner drags, a click on a corner removes
  it (never below 3). Leaving the page or the tab drops the draft. On a phone the sheet closes to draw
  and `ZoneDrawBar` floats over the map. Saving an existing zone always confirms, listing "from -> to"
  and how many bracelets use it (edited in place: they are checked against the new outline from their
  next fix), then sends only the changed fields. The backend's 400 reasons reach the page as
  `ApiError.serverMessages`; a self-intersecting outline gets its own message. Retired zones aren't
  drawn on the map or offered in Penugasan. Zones aren't pushed over /live: the page that changed one
  calls `reloadZones`, other screens see it on their next reconnect. /admin stays as a fallback for now.
- Riwayat (`/riwayat`, `HistorySheet.tsx`, pure summary in `src/lib/history.ts`): past alerts and past
  assignments for a period, read-only, open to all staff. Dates are WIB days (`wibDay` in format.ts),
  both ends included, default the last 7 days; the page loads at most 200 rows and says so when it
  hits that. Each alert shows who held the bracelet when it opened (the backend joins assignments by
  time), how long it lasted and how fast staff acknowledged it.
- Replay (`src/lib/replay.ts` pure, `use-replay.ts`, `ReplayBar.tsx`, `ReplayLayer` in MapView): "Lihat
  jejak di peta" on every Riwayat row. An assignment replays start to end (to now while it runs); an
  alert replays the assignment it happened in with the cursor on the alert (the backend's alert list
  carries assignmentStartedAt/EndedAt), or half an hour either side without one. Longer than 24 h (the
  backend's GET /fixes/range limit) is cut: around the alert, else the last 24 h, and the bar says so.
  The path is solid up to the cursor and faint after, coloured by status; a slider steps through the
  reported points, play moves the cursor in time at 10x, 60x or 300x (ticks every 100 ms, not every
  frame, so the whole shell doesn't re-render 60 times a second). The request lives in the shell
  (`replay`); leaving the page stops it, and the live trail is hidden meanwhile. On a phone the sheet
  closes and the bar sits under the status card; on a desktop it sits between the sheet and the alert
  panel. Fixes older than the backend's FIX_RETENTION_DAYS (default 90) are gone: the bar says so.
- Export ("Unduh CSV", `src/lib/history-csv.ts` pure): the current tab and period, with the page's
  search and type filter, fetched again with limit 5000. Semicolons and a UTF-8 byte order mark so
  Excel with Indonesian settings opens it in columns; WIB times as "2026-11-18 08:05:09"; minutes with
  a decimal comma; text starting with = + - @ gets a leading apostrophe so Excel never runs it.
- Pengaturan (`/pengaturan`, `SettingsSheet.tsx`, rules in `src/lib/settings.ts`): report intervals per
  state, signal-lost threshold, and the debounce counts. Everyone can read it, only a superadmin can
  edit (the backend answers 403 otherwise). Saving asks first and lists "from -> to", then sends only
  the changed fields so the audit log shows what moved. Limits mirror the backend's; the backend
  enforces them. Alarm counts apply at once; a bracelet gets a new interval at its next report.
- Phone sheets (`BottomSheet.tsx`, used by `PhoneSheet.tsx` for the map page's list and `PageSheet.tsx`
  for every other page; `SheetHandle.tsx` draws the strip): drag the handle and the sheet follows the
  finger, then settles on the nearest stop (a flick carries it further); a tap steps to the next stop and
  the arrow closes. Stops: closed, half, full on the map page; closed, full elsewhere. Closed leaves only
  the map, the status card, the tab bar and the handle docked above the tab bar (2.25rem). While
  dragging, the height is written straight to the element (no re-render per move); React state changes
  only when the sheet settles. The sheet rests on CSS heights, so it follows the screen when it turns.
  Closed content is `inert` on a phone. Keep HALF_RATIO (BottomSheet) in step with `--sheet-half`
  (globals.css) and `coveredEdges` (MapView).
  State lives in AppShell (`phoneSheet` in the shell context): going to another page opens its sheet, and
  a new unseen alert reopens the map page's list (other pages don't show alerts, so there it only turns
  the status card red). Sheets stay mounted while closed, so a half-filled form survives. Desktop is
  unchanged. `data-sheet="closed"` on the map wrapper moves Leaflet's corner controls down (globals.css).
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
