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
  backend directly (NEXT_PUBLIC_API_URL, backend CORS_ORIGINS must list this origin).
- Login is the shared ADMIN_API_KEY, stored in sessionStorage via a small store read with
  useSyncExternalStore (`src/lib/session.ts`). Staff accounts are the next step and replace it.
- Data flow (`src/lib/use-live-data.ts`): load zones, latest fixes, open alerts and open assignments
  over REST on every (re)connect, then apply /live events (fix, episode, alert_acknowledged,
  assignment). A REST snapshot never replaces a newer pushed fix.
- Leaflet only in `src/components/MapView.tsx`, loaded with next/dynamic `ssr: false`.
  GeoJSON is [lng, lat]; Leaflet is [lat, lng]; convert only in ringToLatLngs.
- Response types in `src/lib/types.ts` mirror the backend; update both together.
- App structure: `AppShell` sits above all pages (mounted by `App` in the root layout) and owns the
  map, live data, alarm and selection, shared through `useShell()` (`src/lib/live-context.ts`). Pages
  only add a sheet over the map, so status and alerts stay visible and the map keeps its view.
- Look: Gojek-inspired layout and shapes, plain serious wording, no illustrations, not its branding.
  Brand blue #0046a8 matches Gojek green's saturation and lightness; keep it off the map, because it
  sits close to signal-lost purple. Warn markers use amber #fbbf24, text keeps the darker amber.
- Status display: `src/lib/status.ts` holds the pure rules (open episode beats latest fix, tally, the
  card headline; offline or failed data always beats a calm headline). Every status has its own
  shape from `src/lib/glyph.ts`, shared by the lists and the map, so status never relies on colour.
  The status card fills red only for an unacknowledged out-of-zone alert.
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

## Rules
- Run `npx tsc --noEmit`, `npm run lint` and `npm run build` before finishing a change.
- Never commit `.env.local`; keep `.env.example` current.
- The user commits themselves; leave changes uncommitted.
