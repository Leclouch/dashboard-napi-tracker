import type { Episode, EpisodeType } from "./types";

export interface AlertSummary {
  total: number;
  byType: Record<EpisodeType, number>;
  /** Nobody has acknowledged these (yet). */
  unseen: number;
  /** Mean time from an alert opening to staff acknowledging it; null if none was acknowledged. */
  averageResponseMs: number | null;
}

/** What the top of the history page says about the alerts it lists. */
export function summariseAlerts(alerts: Episode[]): AlertSummary {
  const byType: Record<EpisodeType, number> = { alert: 0, warn: 0, signal_lost: 0 };
  let unseen = 0;
  let responseTotal = 0;
  let responded = 0;

  for (const alert of alerts) {
    byType[alert.type] += 1;
    if (alert.acknowledgedAt === null) {
      unseen += 1;
      continue;
    }
    responseTotal += responseMs(alert) ?? 0;
    responded += 1;
  }

  return {
    total: alerts.length,
    byType,
    unseen,
    averageResponseMs: responded > 0 ? responseTotal / responded : null,
  };
}

/** How long staff took to acknowledge an alert, or null if nobody has. */
export function responseMs(alert: Episode): number | null {
  if (alert.acknowledgedAt === null) return null;
  return Math.max(0, new Date(alert.acknowledgedAt).getTime() - new Date(alert.triggeredAt).getTime());
}
