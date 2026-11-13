import type { Assignment, Episode, EpisodeType, Fix, FixStatus } from "./types";

/** What one bracelet is showing right now: its open episode if it has one, else its latest fix. */
export type DisplayStatus = FixStatus | EpisodeType;

/** A click on a bracelet. `at` makes a repeat click on the same one a new selection, so the map flies back. */
export interface Selection {
  braceletId: number;
  at: number;
}

const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;
const SESSION_WARNING_MS = 30 * 60 * 1000;

/**
 * When the login runs out, if that is close. A connected dashboard renews its session all the
 * time, so this only matters while offline: the session then ends 12 hours after the connection
 * dropped (the backend waits longer while an alert is open). Null when there's nothing to warn about.
 */
export function sessionEndsAt(offlineSince: number | null, now: number): number | null {
  if (offlineSince === null) return null;
  const endsAt = offlineSince + SESSION_IDLE_MS;
  return endsAt - now <= SESSION_WARNING_MS ? endsAt : null;
}

export function displayStatus(alert: Episode | undefined, fix: Fix | undefined): DisplayStatus | null {
  return alert?.type ?? fix?.status ?? null;
}

const SEVERITY: Record<DisplayStatus, number> = {
  alert: 0,
  signal_lost: 1,
  warn: 2,
  normal: 3,
  unassigned: 4,
};

/** Sort key: most urgent first. null (no position yet) sorts after everything with a status. */
export function severityRank(status: DisplayStatus | null): number {
  return status === null ? 5 : SEVERITY[status];
}

export interface Tally {
  alert: number;
  signal_lost: number;
  warn: number;
  normal: number;
  /** Assigned, but no fix since the bracelet was handed out. */
  noPosition: number;
  total: number;
}

/** Counts the bracelets in use by status. Bracelets not handed out don't count. */
export function tallyBracelets(
  assignments: Assignment[],
  alerts: Episode[],
  fixes: Record<number, Fix>,
): Tally {
  const alertByBracelet = new Map(alerts.map((a) => [a.braceletId, a]));
  const tally: Tally = { alert: 0, signal_lost: 0, warn: 0, normal: 0, noPosition: 0, total: 0 };
  for (const { braceletId } of assignments) {
    const status = displayStatus(alertByBracelet.get(braceletId), fixes[braceletId]);
    tally.total += 1;
    // A fix stored as 'unassigned' dates from before this assignment, so it says nothing about now.
    if (status === null || status === "unassigned") tally.noPosition += 1;
    else tally[status] += 1;
  }
  return tally;
}

export type BandTone = "calm" | "idle" | "warn" | "signal" | "alert" | "offline";

export interface Situation {
  tone: BandTone;
  headline: string;
}

/**
 * The one sentence at the top of the screen. Broken data comes first on purpose: a calm band
 * over numbers that stopped updating is the most dangerous thing this screen could show.
 */
export function describeSituation(input: {
  connection: "connecting" | "online" | "offline";
  loaded: boolean;
  failed: boolean;
  tally: Tally;
}): Situation {
  const { connection, loaded, failed, tally } = input;
  if (connection === "offline") {
    return { tone: "offline", headline: "Koneksi terputus, data bisa tertinggal" };
  }
  if (failed) return { tone: "offline", headline: "Data gagal dimuat, tampilan bisa tertinggal" };
  if (!loaded) return { tone: "idle", headline: "Memuat data…" };
  if (tally.alert > 0) return { tone: "alert", headline: `${tally.alert} gelang di luar zona` };
  if (tally.signal_lost > 0) {
    return { tone: "signal", headline: `${tally.signal_lost} gelang sinyal hilang` };
  }
  if (tally.warn > 0) return { tone: "warn", headline: `${tally.warn} gelang dekat batas zona` };
  if (tally.total === 0) return { tone: "idle", headline: "Tidak ada gelang dipakai" };
  if (tally.noPosition > 0) {
    return { tone: "idle", headline: `${tally.noPosition} gelang belum mengirim posisi` };
  }
  return { tone: "calm", headline: "Semua gelang di dalam zona" };
}
