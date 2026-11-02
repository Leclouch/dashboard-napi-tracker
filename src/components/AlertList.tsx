"use client";

import { EPISODE_LABEL, STATUS_COLOR, formatAgo, formatDistance, formatTime } from "@/lib/format";
import type { Assignment, Episode, EpisodeType, Fix } from "@/lib/types";
import { DirectionsIcon } from "./Icons";
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

/** Google Maps wants lat,lng here, unlike GeoJSON. */
function directionsUrl(fix: Fix): string {
  return `https://www.google.com/maps/search/?api=1&query=${fix.lat},${fix.lng}`;
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
    return <p className="px-4 py-4 text-sm text-ink-soft">Tidak ada yang perlu ditangani.</p>;
  }

  return (
    <ul className="space-y-2 p-2">
      {sorted.map((alert) => {
        const assignment = assignmentByBracelet.get(alert.braceletId);
        const fix = fixes[alert.braceletId];
        const unacknowledged = alert.acknowledgedAt === null;
        const selected = alert.braceletId === selectedBraceletId;
        return (
          <li
            key={alert.id}
            className={`rounded-xl p-3 ${unacknowledged ? UNSEEN_TINT[alert.type] : "border border-line"} ${
              selected ? "ring-2 ring-ink" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(alert.braceletId)}
              className="flex w-full gap-2.5 rounded-lg text-left"
            >
              <span className="pt-0.5">
                <StatusGlyph status={alert.type} size={24} animated />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-bold" style={{ color: STATUS_COLOR[alert.type] }}>
                    {EPISODE_LABEL[alert.type]}
                  </span>
                  <span className="text-xs text-ink-soft tabular-nums">#{alert.id}</span>
                </span>
                <span className="block text-sm font-semibold text-ink">
                  {alert.deviceLabel ?? `Gelang ${alert.braceletId}`}
                  {assignment && `, ${assignment.inmateName}`}
                </span>
                <span className="block text-sm text-ink">{whereText(alert, fix, now)}</span>
                <span className="block text-xs text-ink-soft tabular-nums">
                  Mulai {formatTime(alert.triggeredAt)} ({formatAgo(alert.triggeredAt, now)})
                </span>
              </span>
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {unacknowledged ? (
                <button
                  type="button"
                  onClick={() => onAcknowledge(alert.id)}
                  className="min-h-10 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Tandai sudah dilihat
                </button>
              ) : (
                <span className="text-xs text-ink-soft tabular-nums">
                  Dilihat {formatTime(alert.acknowledgedAt as string)}
                </span>
              )}
              {fix && (
                <a
                  href={directionsUrl(fix)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-brand bg-white px-3 text-sm font-semibold text-brand hover:bg-ground"
                >
                  <DirectionsIcon size={18} />
                  {alert.type === "signal_lost" ? "Ke posisi terakhir" : "Petunjuk arah"}
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
