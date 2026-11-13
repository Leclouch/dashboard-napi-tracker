// The app only renders in the browser, once the login is known, so Next.js has no prerendered
// page to check for instant navigation. Pages are switched on the client and need no data first.
export const instant = false;

/** Pemantauan: the map and panels live in AppShell, so this page adds nothing on top of them. */
export default function MonitorPage() {
  return null;
}
