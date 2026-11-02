"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ShellContext, type Shell } from "@/lib/live-context";
import { clearApiKey } from "@/lib/session";
import { describeSituation, tallyBracelets, type Selection } from "@/lib/status";
import { useAlarm } from "@/lib/use-alarm";
import { useLiveData } from "@/lib/use-live-data";
import ListPanel from "./ListPanel";
import NavBar from "./NavBar";
import PhoneSheet from "./PhoneSheet";
import StatusCard from "./StatusCard";

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
export default function AppShell({ apiKey, children }: { apiKey: string; children: ReactNode }) {
  const live = useLiveData(apiKey, clearApiKey);
  const now = useNow(5000);
  const alarm = useAlarm(live.openAlerts);
  const pathname = usePathname();
  const router = useRouter();
  const onMonitor = pathname === "/";
  const [selection, setSelection] = useState<Selection | null>(null);
  /** The unseen alerts when the panel was closed; anything newer reopens it. */
  const [collapsedOn, setCollapsedOn] = useState<ReadonlySet<string> | null>(null);

  const tally = tallyBracelets(live.openAssignments, live.openAlerts, live.fixes);
  const situation = describeSituation({
    connection: live.connection,
    loaded: live.loaded,
    failed: live.error !== null,
    tally,
  });
  const unseen = live.openAlerts.filter((a) => a.acknowledgedAt === null);
  const unseenKeys = unseen.map((a) => `${a.id}:${a.type}`);
  const collapsed = collapsedOn !== null && unseenKeys.every((key) => collapsedOn.has(key));

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
      logout: clearApiKey,
    }),
    [live, alarm, now, selection, pathname, router],
  );

  return (
    <ShellContext.Provider value={shell}>
      <div className="fixed inset-0">
        <MapView
          zones={live.zones}
          fixes={Object.values(live.fixes)}
          openAlerts={live.openAlerts}
          assignments={live.openAssignments}
          now={now}
          selection={selection}
          onSelect={shell.select}
          onClearSelection={() => setSelection(null)}
        />
      </div>

      <NavBar />

      <div className="pointer-events-none fixed inset-x-2 top-2 z-[1100] flex flex-col gap-3 lg:inset-x-auto lg:top-3 lg:right-3 lg:bottom-3 lg:w-[23rem]">
        <StatusCard
          situation={situation}
          tally={tally}
          urgent={unseen.some((a) => a.type === "alert")}
        />
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
        <PhoneSheet>
          <ListPanel showBracelets />
        </PhoneSheet>
      )}

      {children}
    </ShellContext.Provider>
  );
}
