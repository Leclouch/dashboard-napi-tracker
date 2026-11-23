// Pure rules for replaying a past path in Riwayat. No React, no Leaflet.

import { thinPoints } from "./trail";
import type { Assignment, Episode, FixStatus, ReplayPoint } from "./types";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
/** The backend's longest range (fix-range.ts MAX_RANGE_HOURS). */
export const MAX_REPLAY_MS = 24 * HOUR;
/** Before and after an alert that happened outside any assignment. */
const ALERT_MARGIN_MS = 30 * MINUTE;

/** What to replay: whose path, over which period, and where the cursor starts. */
export interface ReplayRequest {
  braceletId: number;
  deviceLabel: string;
  /** Who wore it, for the heading; null when nobody did. */
  inmateName: string | null;
  from: string;
  to: string;
  /** Where the cursor starts: the alert, or the start of the period. */
  startAt: string;
  /** The period was longer than the backend allows and was cut to 24 hours. */
  clipped: boolean;
}

/**
 * Fits [start, end] into 24 hours. With a focus (an alert), keeps an hour before it and as much
 * after as fits; without one, keeps the last 24 hours, the part closest to the end of the shift.
 */
function clip(start: number, end: number, focus: number | null): { from: number; to: number; clipped: boolean } {
  if (end - start <= MAX_REPLAY_MS) return { from: start, to: end, clipped: false };
  if (focus === null) return { from: end - MAX_REPLAY_MS, to: end, clipped: true };
  const from = Math.max(start, focus - HOUR);
  return { from, to: Math.min(end, from + MAX_REPLAY_MS), clipped: true };
}

function request(
  braceletId: number,
  deviceLabel: string,
  inmateName: string | null,
  window: { from: number; to: number; clipped: boolean },
  startAt: number,
): ReplayRequest {
  return {
    braceletId,
    deviceLabel,
    inmateName,
    from: new Date(window.from).toISOString(),
    to: new Date(window.to).toISOString(),
    startAt: new Date(Math.min(Math.max(startAt, window.from), window.to)).toISOString(),
    clipped: window.clipped,
  };
}

/** A whole assignment, start to end (or to now while it runs). */
export function replayForAssignment(assignment: Assignment, now: number): ReplayRequest {
  const start = Date.parse(assignment.startedAt);
  const end = assignment.endedAt ? Date.parse(assignment.endedAt) : now;
  return request(
    assignment.braceletId,
    assignment.deviceLabel,
    assignment.inmateName,
    clip(start, end, null),
    start,
  );
}

/**
 * The assignment an alert happened in, with the cursor on the alert. An alert outside any
 * assignment (only warn or alert from an old fix can be) gets half an hour either side.
 */
export function replayForAlert(alert: Episode, now: number): ReplayRequest {
  const opened = Date.parse(alert.triggeredAt);
  const closed = alert.resolvedAt ? Date.parse(alert.resolvedAt) : now;
  const start = alert.assignmentStartedAt ? Date.parse(alert.assignmentStartedAt) : opened - ALERT_MARGIN_MS;
  const end = alert.assignmentStartedAt
    ? alert.assignmentEndedAt
      ? Date.parse(alert.assignmentEndedAt)
      : now
    : Math.min(now, closed + ALERT_MARGIN_MS);
  return request(
    alert.braceletId,
    alert.deviceLabel ?? `gelang ${alert.braceletId}`,
    alert.inmateName ?? null,
    clip(start, Math.max(end, opened), opened),
    opened,
  );
}

/** The last point reported at or before `at` (0 before the first). Binary search: paths are long. */
export function pointIndexAt(points: { recordedAt: string }[], at: number): number {
  let low = 0;
  let high = points.length - 1;
  let found = 0;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (Date.parse(points[middle].recordedAt) <= at) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

export interface StatusRun {
  status: FixStatus;
  positions: [number, number][];
}

/** The path as a few lines of one status each, after dropping GPS jitter. [lat, lng] pairs. */
export function statusRuns(points: ReplayPoint[]): StatusRun[] {
  const path = thinPoints(points);
  const runs: StatusRun[] = [];
  for (let i = 1; i < path.length; i++) {
    const run = runs[runs.length - 1];
    if (run && run.status === path[i].status) {
      run.positions.push([path[i].lat, path[i].lng]);
    } else {
      runs.push({
        status: path[i].status,
        positions: [
          [path[i - 1].lat, path[i - 1].lng],
          [path[i].lat, path[i].lng],
        ],
      });
    }
  }
  return runs;
}

/** Playback speeds: how many seconds of the path pass per real second. */
export const REPLAY_SPEEDS = [10, 60, 300] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];
