"use client";

import { EPISODE_LABEL, FIX_STATUS_LABEL, formatAgo } from "@/lib/format";
import { displayStatus, severityRank } from "@/lib/status";
import type { Assignment, Episode, Fix } from "@/lib/types";
import StatusGlyph from "./StatusGlyph";

interface Props {
  assignments: Assignment[];
  alerts: Episode[];
  fixes: Record<number, Fix>;
  now: number;
  selectedBraceletId: number | null;
  onSelect: (braceletId: number) => void;
}

/** Bracelets currently handed out, most urgent first. */
export default function AssignmentList({
  assignments,
  alerts,
  fixes,
  now,
  selectedBraceletId,
  onSelect,
}: Props) {
  if (assignments.length === 0) {
    return <p className="px-4 py-4 text-sm text-ink-soft">Tidak ada gelang yang sedang dipakai.</p>;
  }

  const alertByBracelet = new Map(alerts.map((a) => [a.braceletId, a]));
  const rows = assignments
    .map((assignment) => {
      const alert = alertByBracelet.get(assignment.braceletId);
      const fix = fixes[assignment.braceletId];
      return { assignment, alert, fix, status: displayStatus(alert, fix) };
    })
    .sort((a, b) => severityRank(a.status) - severityRank(b.status));

  return (
    <ul className="divide-y divide-line">
      {rows.map(({ assignment, alert, fix, status }) => {
        const selected = assignment.braceletId === selectedBraceletId;
        return (
          <li key={assignment.id}>
            <button
              type="button"
              onClick={() => onSelect(assignment.braceletId)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-ground ${
                selected ? "bg-selected" : ""
              }`}
            >
              {status ? <StatusGlyph status={status} size={20} /> : <span className="w-5" />}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-bold text-ink">{assignment.inmateName}</span>
                  <span className="text-xs text-ink-soft">{assignment.deviceLabel}</span>
                </span>
                <span className="block text-sm text-ink-soft">
                  {status && fix
                    ? `${alert ? EPISODE_LABEL[alert.type] : FIX_STATUS_LABEL[fix.status]}, ${formatAgo(fix.recordedAt, now)}`
                    : "Belum ada posisi"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
