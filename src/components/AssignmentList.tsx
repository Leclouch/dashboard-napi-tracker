"use client";

import { EPISODE_LABEL, FIX_STATUS_LABEL, formatAgo, formatDateTime } from "@/lib/format";
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
    return <p className="px-4 py-4 text-base text-ink-soft">Tidak ada gelang yang sedang dipakai.</p>;
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
              className={`block w-full px-4 py-2 text-left hover:bg-ground ${selected ? "bg-selected" : ""}`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold text-ink">{assignment.inmateName}</span>
                <span className="text-sm text-ink-soft">{assignment.deviceLabel}</span>
              </span>
              <span className="mt-0.5 flex items-center gap-2 text-sm text-ink">
                {status && fix ? (
                  <>
                    <StatusGlyph status={status} />
                    <span>
                      {alert ? EPISODE_LABEL[alert.type] : FIX_STATUS_LABEL[fix.status]},{" "}
                      {formatAgo(fix.recordedAt, now)}
                    </span>
                  </>
                ) : (
                  <span className="text-ink-soft">Belum ada posisi</span>
                )}
              </span>
              <span className="block text-sm text-ink-soft">
                Zona {assignment.zoneName}, petugas {assignment.guardName}
              </span>
              <span className="block text-sm text-ink-soft">Mulai {formatDateTime(assignment.startedAt)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
