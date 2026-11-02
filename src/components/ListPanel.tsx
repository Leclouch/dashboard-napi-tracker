"use client";

import { useShell } from "@/lib/live-context";
import AlertList from "./AlertList";
import AssignmentList from "./AssignmentList";
import { ChevronIcon } from "./Icons";

interface Props {
  /** Penugasan shows the running assignments itself, so the panel keeps only the alerts. */
  showBracelets: boolean;
  /** Only the desktop panel can collapse; the phone sheet has its own two stops. */
  collapse?: { collapsed: boolean; toggle: () => void };
}

/** Alerts and bracelets in use. The same content sits in the desktop panel and the phone sheet. */
export default function ListPanel({ showBracelets, collapse }: Props) {
  const { live, now, selection, select } = useShell();
  const unseen = live.openAlerts.filter((a) => a.acknowledgedAt === null).length;
  const selectedBraceletId = selection?.braceletId ?? null;
  const collapsed = collapse?.collapsed ?? false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex min-h-12 items-center gap-2 border-b border-line px-4">
        <h2 className="flex-1 text-base font-bold text-ink">Perlu perhatian</h2>
        {unseen > 0 && (
          <span className="rounded-full bg-[#b91c1c] px-2.5 py-0.5 text-xs font-bold text-white tabular-nums">
            {unseen} belum dilihat
          </span>
        )}
        {collapse && (
          <button
            type="button"
            onClick={collapse.toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Buka panel" : "Tutup panel"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-ground"
          >
            <ChevronIcon open={!collapsed} />
          </button>
        )}
      </header>

      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="border-b border-line bg-ground px-4 py-2 text-xs text-ink-soft lg:hidden">
            Suara bisa berhenti saat layar terkunci. Peringatan tetap dikirim lewat Telegram.
          </p>
          <AlertList
            alerts={live.openAlerts}
            assignments={live.openAssignments}
            fixes={live.fixes}
            now={now}
            selectedBraceletId={selectedBraceletId}
            onAcknowledge={live.acknowledge}
            onSelect={select}
          />
          {showBracelets && (
            <>
              <h2 className="border-y border-line px-4 py-2.5 text-base font-bold text-ink">
                Gelang dipakai ({live.openAssignments.length})
              </h2>
              <AssignmentList
                assignments={live.openAssignments}
                alerts={live.openAlerts}
                fixes={live.fixes}
                now={now}
                selectedBraceletId={selectedBraceletId}
                onSelect={select}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
