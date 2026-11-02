"use client";

import { EPISODE_LABEL, STATUS_COLOR, formatAgo, formatDistance, formatTime } from "@/lib/format";
import type { Assignment, Episode, EpisodeType, Fix } from "@/lib/types";
import StatusGlyph from "./StatusGlyph";

/** The tint follows severity, and only while the alert is unacknowledged. */
const UNSEEN_TINT: Record<EpisodeType, string> = {
  alert: "bg-alert-tint",
  signal_lost: "bg-signal-tint",
  warn: "bg-warn-tint",
};

const SEVERITY: Record<EpisodeType, number> = { alert: 0, signal_lost: 1, warn: 2 };

/** What staff need to act on: how far out, or how old the last known position is. */
function whereText(alert: Episode, fix: Fix | undefined, now: number): string {
  if (!fix) return "Belum ada posisi";
  if (alert.type === "signal_lost") return `Posisi terakhir ${formatAgo(fix.recordedAt, now)}`;
  return formatDistance(fix.distanceOutsideMeters) ?? "Kembali ke dalam zona";
}

interface Props {
  alerts: Episode[];
  assignments: Assignment[];
  fixes: Record<number, Fix>;
  now: number;
  selectedBraceletId: number | null;
  onAcknowledge: (alertId: number) => void;
  onSelect: (braceletId: number) => void;
}

/** Open alert episodes: unacknowledged first, then most severe, then newest. */
export default function AlertList({
  alerts,
  assignments,
  fixes,
  now,
  selectedBraceletId,
  onAcknowledge,
  onSelect,
}: Props) {
  const assignmentByBracelet = new Map(assignments.map((a) => [a.braceletId, a]));
  const sorted = [...alerts].sort(
    (a, b) =>
      Number(a.acknowledgedAt !== null) - Number(b.acknowledgedAt !== null) ||
      SEVERITY[a.type] - SEVERITY[b.type] ||
      b.triggeredAt.localeCompare(a.triggeredAt),
  );

  if (sorted.length === 0) {
    return <p className="px-4 py-4 text-base text-ink-soft">Tidak ada yang perlu ditangani.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {sorted.map((alert) => {
        const assignment = assignmentByBracelet.get(alert.braceletId);
        const unacknowledged = alert.acknowledgedAt === null;
        const selected = alert.braceletId === selectedBraceletId;
        return (
          <li
            key={alert.id}
            className={`px-4 py-3 ${unacknowledged ? UNSEEN_TINT[alert.type] : ""} ${
              selected ? "shadow-[inset_4px_0_0_var(--color-ink)]" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(alert.braceletId)}
              className="flex w-full gap-3 text-left"
            >
              <span className="pt-0.5">
                <StatusGlyph status={alert.type} size={26} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold" style={{ color: STATUS_COLOR[alert.type] }}>
                    {EPISODE_LABEL[alert.type]}
                  </span>
                  <span className="text-sm text-ink-soft tabular-nums">#{alert.id}</span>
                </span>
                <span className="block text-base font-semibold text-ink">
                  {alert.deviceLabel ?? `Gelang ${alert.braceletId}`}
                  {assignment && `, ${assignment.inmateName}`}
                </span>
                <span className="block text-base text-ink">
                  {whereText(alert, fixes[alert.braceletId], now)}
                </span>
                <span className="block text-sm text-ink-soft tabular-nums">
                  Mulai {formatTime(alert.triggeredAt)} ({formatAgo(alert.triggeredAt, now)})
                </span>
              </span>
            </button>
            {unacknowledged ? (
              <button
                type="button"
                onClick={() => onAcknowledge(alert.id)}
                className="mt-2 ml-[38px] min-h-10 rounded bg-ink px-3 text-sm font-semibold text-white hover:bg-ink-soft"
              >
                Tandai sudah dilihat
              </button>
            ) : (
              <p className="mt-1 ml-[38px] text-sm text-ink-soft tabular-nums">
                Dilihat {formatTime(alert.acknowledgedAt as string)}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
