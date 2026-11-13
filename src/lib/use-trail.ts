"use client";

import { useEffect, useState } from "react";
import type { Api } from "./api";
import type { Fix, TrailPoint } from "./types";

/**
 * How far back the path of the selected bracelet can reach, in minutes. The longest stays within
 * the backend's 5000 points per bracelet (about 4 hours at a 3 s interval); longer would be cut.
 */
export const TRAIL_OPTIONS = [60, 120, 240] as const;
export type TrailMinutes = (typeof TRAIL_OPTIONS)[number];
export const DEFAULT_TRAIL_MINUTES: TrailMinutes = 60;
/** Same cap as the backend's per-bracelet limit, so a long session can't grow without bound. */
const MAX_POINTS = 5000;

interface Loaded {
  braceletId: number;
  points: TrailPoint[];
}

function toPoint(fix: Fix): TrailPoint {
  return { lat: fix.lat, lng: fix.lng, status: fix.status, recordedAt: fix.recordedAt };
}

function time(point: TrailPoint): number {
  return Date.parse(point.recordedAt);
}

/**
 * The path of the selected bracelet, oldest point first; empty when nothing is selected.
 *
 * The stored path is fetched once when a bracelet is selected, then every new live fix is
 * appended, so the line grows while staff watch. The two sources can overlap (a fix may arrive
 * both ways), so a point is only added when it is newer than the last one.
 *
 * The trail is a convenience: if loading fails, the map simply shows no line.
 */
export function useTrail(
  api: Api,
  braceletId: number | null,
  latest: Fix | undefined,
  minutes: number,
): TrailPoint[] {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (braceletId === null) return;
    let cancelled = false;
    api.trails(minutes).then(
      (trails) => {
        if (cancelled) return;
        const fetched = trails.find((t) => t.braceletId === braceletId)?.points ?? [];
        const lastFetched = fetched.length > 0 ? time(fetched[fetched.length - 1]) : -Infinity;
        setLoaded((prev) => {
          // Fixes pushed while the request was on its way aren't in the response yet.
          const pushed =
            prev?.braceletId === braceletId ? prev.points.filter((p) => time(p) > lastFetched) : [];
          return { braceletId, points: [...fetched, ...pushed].slice(-MAX_POINTS) };
        });
      },
      () => {
        if (!cancelled) setLoaded((prev) => (prev?.braceletId === braceletId ? prev : { braceletId, points: [] }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [api, braceletId, minutes]);

  // Adjusting state while rendering (instead of in an effect) saves a second render per fix.
  // The comparison with the last fix seen keeps it from looping.
  const [seen, setSeen] = useState(latest);
  if (latest !== seen) {
    setSeen(latest);
    if (braceletId !== null && latest && latest.braceletId === braceletId) {
      const point = toPoint(latest);
      setLoaded((prev) => {
        const points = prev?.braceletId === braceletId ? prev.points : [];
        const last = points[points.length - 1];
        if (last && time(last) >= time(point)) return prev;
        return { braceletId, points: [...points, point].slice(-MAX_POINTS) };
      });
    }
  }

  return braceletId !== null && loaded?.braceletId === braceletId ? loaded.points : [];
}
