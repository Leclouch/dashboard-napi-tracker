# Gelang GPS dashboard

Live monitoring screen for the GPS bracelet project at Lapas Cebongan: map with zones and bracelet
positions, open alerts (with acknowledge), and the bracelets currently handed out. The UI is in
Bahasa Indonesia. Data comes from the backend (`../backend-napi-tracker`): REST for the current
state, Socket.IO (`/live`) for changes.

## Run it locally

1. Start the backend (Postgres in Docker, then `npm run start:dev` in `backend-napi-tracker`).
   Its `.env` must contain `CORS_ORIGINS=http://localhost:3001`.
2. Here: `copy .env.example .env.local` (first time only), then:

```powershell
npm install
npm run dev
```

3. Open http://localhost:3001 and log in with the backend's `ADMIN_API_KEY`.

The key is kept in sessionStorage (gone when the tab closes). This shared-key login is temporary
until staff accounts exist.

## Configuration

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL as the browser reaches it, default `http://localhost:3000`. Baked in at build time. |

## Layout

| Path | Contents |
|---|---|
| `src/app/` | Root layout, Pemantauan (`/`) and Penugasan (`/penugasan`) |
| `src/components/App.tsx` | Login form or the app, depending on the stored key |
| `src/components/AppShell.tsx` | Full-screen map, navbar and panels, shared by every page |
| `src/components/NavBar.tsx` | Floating bar on desktop, bottom tabs on phones |
| `src/components/StatusCard.tsx` | The status headline and counts |
| `src/components/ListPanel.tsx`, `PhoneSheet.tsx` | Alert and bracelet lists, and the phone sheet |
| `src/components/AssignmentsSheet.tsx` | Start and end assignments |
| `src/components/MapView.tsx` | Leaflet map (client only, loaded with `ssr: false`) |
| `src/lib/live-context.ts` | Shared state for the pages (`useShell`) |
| `src/lib/status.ts`, `glyph.ts` | Status rules (tally, headline) and the shape for each status |
| `src/lib/use-alarm.ts` | Alarm sound for new alerts |
| `src/lib/use-live-data.ts` | REST snapshot + Socket.IO updates |
| `src/lib/api.ts`, `types.ts` | Backend calls and response shapes |
| `src/lib/format.ts` | Indonesian labels, WIB times, status colours |
