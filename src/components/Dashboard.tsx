"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { clearApiKey } from "@/lib/session";
import { describeSituation, tallyBracelets, type Selection } from "@/lib/status";
import { useAlarm } from "@/lib/use-alarm";
import { useLiveData } from "@/lib/use-live-data";
import AlertList from "./AlertList";
import AssignmentList from "./AssignmentList";
import StatusBand from "./StatusBand";

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

export default function Dashboard({ apiKey }: { apiKey: string }) {
  const live = useLiveData(apiKey, clearApiKey);
  const now = useNow(5000);
  const alarm = useAlarm(live.openAlerts);
  const [selection, setSelection] = useState<Selection | null>(null);

  const tally = tallyBracelets(live.openAssignments, live.openAlerts, live.fixes);
  const situation = describeSituation({
    connection: live.connection,
    loaded: live.loaded,
    failed: live.error !== null,
    tally,
  });
  const unacknowledged = live.openAlerts.filter((a) => a.acknowledgedAt === null);

  // The count in the browser tab shows up even when another window covers the dashboard.
  useEffect(() => {
    document.title = unacknowledged.length > 0 ? `(${unacknowledged.length}) Gelang GPS` : "Gelang GPS";
    return () => {
      document.title = "Gelang GPS";
    };
  }, [unacknowledged.length]);

  const select = (braceletId: number) => setSelection({ braceletId, at: Date.now() });

  return (
    <div className="flex h-dvh flex-col bg-ground">
      <StatusBand
        situation={situation}
        tally={tally}
        connection={live.connection}
        pulsing={unacknowledged.some((a) => a.type === "alert")}
        alarm={alarm}
        onLogout={clearApiKey}
      />

      {live.error && (
        <div className="border-b border-line bg-alert-tint px-4 py-2 text-sm text-[#7f1212]">{live.error}</div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="h-[45vh] min-h-0 lg:h-auto lg:flex-1">
          <MapView
            zones={live.zones}
            fixes={Object.values(live.fixes)}
            openAlerts={live.openAlerts}
            now={now}
            selection={selection}
            onSelect={select}
            onClearSelection={() => setSelection(null)}
          />
        </div>

        <aside className="min-h-0 flex-1 overflow-y-auto border-line bg-white lg:w-[28rem] lg:flex-none lg:border-l">
          <section>
            <h2 className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-4 py-2 text-lg font-bold text-ink">
              Perlu perhatian
              {unacknowledged.length > 0 && (
                <span className="text-sm font-medium text-[#b91c1c]">{unacknowledged.length} belum dilihat</span>
              )}
            </h2>
            <AlertList
              alerts={live.openAlerts}
              assignments={live.openAssignments}
              fixes={live.fixes}
              now={now}
              selectedBraceletId={selection?.braceletId ?? null}
              onAcknowledge={live.acknowledge}
              onSelect={select}
            />
          </section>
          <section>
            <h2 className="sticky top-0 z-10 border-y border-line bg-white px-4 py-2 text-lg font-bold text-ink">
              Gelang dipakai ({live.openAssignments.length})
            </h2>
            <AssignmentList
              assignments={live.openAssignments}
              alerts={live.openAlerts}
              fixes={live.fixes}
              now={now}
              selectedBraceletId={selection?.braceletId ?? null}
              onSelect={select}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
