"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ShellContext, type Shell } from "@/lib/live-context";
import { describeSituation, sessionEndsAt, tallyBracelets, type Selection } from "@/lib/status";
import { formatDateTime } from "@/lib/format";
import type { Me } from "@/lib/types";
import { useAlarm } from "@/lib/use-alarm";
import { useLiveData } from "@/lib/use-live-data";
import { DEFAULT_TRAIL_MINUTES, useTrail, type TrailMinutes } from "@/lib/use-trail";
import AccountMenu from "./AccountMenu";
import ListPanel from "./ListPanel";
import NavBar from "./NavBar";
import PhoneSheet from "./PhoneSheet";
import StatusCard from "./StatusCard";
import TrailRange from "./TrailRange";
import ZoneDrawBar from "./ZoneDrawBar";
import type { ZoneDraft } from "@/lib/zone-draft";

// Leaflet needs `window`, so the map is never prerendered on the server.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-ink-soft">Memuat peta…</div>,
});

/** Refreshes "x menit lalu" texts. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * Lives above the pages, so the socket, the alarm and the map keep running while staff move
 * between them. Pages only add a sheet on top of the map; status and alerts stay visible.
 */
export default function AppShell({ me, children }: { me: Me; children: ReactNode }) {
  const live = useLiveData();
  const now = useNow(5000);
  const alarm = useAlarm(live.openAlerts);
  const pathname = usePathname();
  const router = useRouter();
  const onMonitor = pathname === "/";
  const [selection, setSelection] = useState<Selection | null>(null);
  const [trailMinutes, setTrailMinutes] = useState<TrailMinutes>(DEFAULT_TRAIL_MINUTES);
  const trail = useTrail(
    live.api,
    selection?.braceletId ?? null,
    selection ? live.fixes[selection.braceletId] : undefined,
    trailMinutes,
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  /** The unseen alerts when the panel was closed; anything newer reopens it. */
  const [collapsedOn, setCollapsedOn] = useState<ReadonlySet<string> | null>(null);
  /** Same idea for the phone's sheet: the unseen alerts when it was closed, or null while open. */
  const [phoneClosedOn, setPhoneClosedOn] = useState<ReadonlySet<string> | null>(null);
  const [sheetPath, setSheetPath] = useState(pathname);
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft | null>(null);

  const tally = tallyBracelets(live.openAssignments, live.openAlerts, live.fixes);
  const situation = describeSituation({
    connection: live.connection,
    loaded: live.loaded,
    failed: live.error !== null,
    tally,
  });
  const unseen = useMemo(
    () => live.openAlerts.filter((a) => a.acknowledgedAt === null),
    [live.openAlerts],
  );
  const unseenKeys = useMemo(() => unseen.map((a) => `${a.id}:${a.type}`), [unseen]);
  const collapsed = collapsedOn !== null && unseenKeys.every((key) => collapsedOn.has(key));

  // Adjusting state while rendering, guarded so it runs once per change. Going to another page
  // opens its sheet; a new unseen alert reopens the map page's list, as it does on a desktop.
  // Other pages don't show alerts, so there a new alert only turns the status card red.
  if (pathname !== sheetPath) {
    setSheetPath(pathname);
    setPhoneClosedOn(null);
    // The zone editor unmounts with its page, so its unsaved outline goes too.
    setZoneDraft(null);
  } else if (phoneClosedOn !== null && onMonitor && !unseenKeys.every((key) => phoneClosedOn.has(key))) {
    setPhoneClosedOn(null);
  }
  const phoneClosed = phoneClosedOn !== null;
  const sessionEnd = sessionEndsAt(live.offlineSince, now);

  // The count in the browser tab shows up even when another window covers the dashboard.
  useEffect(() => {
    document.title = unseen.length > 0 ? `(${unseen.length}) Gelang GPS` : "Gelang GPS";
    return () => {
      document.title = "Gelang GPS";
    };
  }, [unseen.length]);

  const shell: Shell = useMemo(
    () => ({
      live,
      alarm,
      now,
      selection,
      select: (braceletId) => {
        setSelection({ braceletId, at: Date.now() });
        // The map is hidden behind other pages, so a selection always brings it forward.
        if (pathname !== "/") router.push("/");
      },
      me,
      openAccountMenu: () => setAccountMenuOpen(true),
      phoneSheet: {
        closed: phoneClosed,
        setClosed: (closed) => setPhoneClosedOn(closed ? new Set(unseenKeys) : null),
      },
      zoneDraft: { draft: zoneDraft, set: setZoneDraft },
    }),
    [live, alarm, now, selection, pathname, router, me, phoneClosed, unseenKeys, zoneDraft],
  );

  return (
    <ShellContext.Provider value={shell}>
      {/* data-sheet lets globals.css move the map's corner controls down when the sheet is closed. */}
      <div className="fixed inset-0" data-sheet={phoneClosed ? "closed" : "open"}>
        <MapView
          zones={live.zones}
          fixes={Object.values(live.fixes)}
          openAlerts={live.openAlerts}
          assignments={live.openAssignments}
          now={now}
          selection={selection}
          trail={trail}
          sheetClosed={phoneClosed}
          onSelect={shell.select}
          onClearSelection={() => setSelection(null)}
          zoneDraft={zoneDraft}
          onZoneDraftChange={setZoneDraft}
        />
      </div>

      <NavBar />
      {onMonitor && selection && <TrailRange value={trailMinutes} onChange={setTrailMinutes} />}
      {zoneDraft && phoneClosed && (
        <ZoneDrawBar
          draft={zoneDraft}
          onChange={setZoneDraft}
          onDone={() => shell.phoneSheet.setClosed(false)}
        />
      )}

      <div className="pointer-events-none fixed inset-x-2 top-2 z-[1100] flex flex-col gap-3 lg:inset-x-auto lg:top-3 lg:right-3 lg:bottom-3 lg:w-[23rem]">
        <StatusCard
          situation={situation}
          tally={tally}
          urgent={unseen.some((a) => a.type === "alert")}
        />
        {sessionEnd !== null && (
          <p
            role="alert"
            className="pointer-events-auto rounded-xl bg-warn-tint px-4 py-2 text-sm text-[#7a3a04]"
          >
            Koneksi terputus. Anda akan keluar otomatis pada {formatDateTime(new Date(sessionEnd).toISOString())}{" "}
            jika koneksi belum pulih dan tidak ada peringatan terbuka.
          </p>
        )}
        {live.error && (
          <p
            role="alert"
            className="pointer-events-auto rounded-xl bg-alert-tint px-4 py-2 text-sm text-[#7f1212]"
          >
            {live.error}
          </p>
        )}
        <div
          className={`float-surface pointer-events-auto hidden min-h-0 flex-col overflow-hidden rounded-2xl lg:flex ${
            collapsed ? "" : "flex-1"
          }`}
        >
          <ListPanel
            showBracelets={onMonitor}
            collapse={{
              collapsed,
              toggle: () => setCollapsedOn(collapsed ? null : new Set(unseenKeys)),
            }}
          />
        </div>
      </div>

      {onMonitor && (
        <PhoneSheet
          closed={phoneClosed}
          onOpen={() => shell.phoneSheet.setClosed(false)}
          onClose={() => shell.phoneSheet.setClosed(true)}
        >
          <ListPanel showBracelets />
        </PhoneSheet>
      )}

      {children}

      {accountMenuOpen && <AccountMenu onClose={() => setAccountMenuOpen(false)} />}
    </ShellContext.Provider>
  );
}
