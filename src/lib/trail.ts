import type { FixStatus, TrailPoint } from "./types";

// Pure rules for drawing a bracelet's path. No Leaflet here; positions are [lat, lng] pairs.

/**
 * A bracelet standing still still reports, and GPS wobbles by a few metres, which would draw a
 * tangled knot. Points closer than this to the last kept one are skipped.
 */
const MIN_STEP_METERS = 3;
/** The line fades from old to new in this many steps. */
const AGE_BUCKETS = 4;

export interface TrailRun {
  /** Status the bracelet had on arriving at the end of each segment in this run. */
  status: FixStatus;
  /** 0 = oldest, AGE_BUCKETS - 1 = newest. */
  age: number;
  positions: [number, number][];
}

/** Flat-earth distance; accurate to well under a metre at this scale. */
function metersBetween(a: TrailPoint, b: TrailPoint): number {
  const metersPerDegree = 111_320;
  const dLat = (b.lat - a.lat) * metersPerDegree;
  const dLng = (b.lng - a.lng) * metersPerDegree * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/** Drops GPS jitter. Always keeps the first and last point and every change of status. */
export function thinPoints(points: TrailPoint[]): TrailPoint[] {
  if (points.length <= 2) return points;
  const kept = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const last = kept[kept.length - 1];
    if (points[i].status !== last.status || metersBetween(last, points[i]) >= MIN_STEP_METERS) {
      kept.push(points[i]);
    }
  }
  kept.push(points[points.length - 1]);
  return kept;
}

/** Maps a point to its age bucket: 0 for the oldest part of the path, the top bucket for the newest. */
function ageBuckets(path: TrailPoint[]): (point: TrailPoint) => number {
  const start = Date.parse(path[0].recordedAt);
  const span = Date.parse(path[path.length - 1].recordedAt) - start;
  return (point) => {
    const share = span > 0 ? (Date.parse(point.recordedAt) - start) / span : 1;
    return Math.min(AGE_BUCKETS - 1, Math.floor(share * AGE_BUCKETS));
  };
}

export interface TrailDot extends TrailPoint {
  age: number;
}

/**
 * The places the bracelet actually reported from, after thinning. The newest point is left out:
 * the bracelet's own marker sits there.
 */
export function trailDots(points: TrailPoint[]): TrailDot[] {
  const path = thinPoints(points);
  if (path.length < 2) return [];
  const ageOf = ageBuckets(path);
  return path.slice(0, -1).map((point) => ({ ...point, age: ageOf(point) }));
}

/** Zoomed out further than this, the dots are only specks; the line alone shows the way. */
export const DOT_MIN_ZOOM = 15;
/** Distance on screen between two dots, a little more than a dot's width. */
const DOT_GAP_PX = 16;

/**
 * Keeps the dots that are far enough apart on screen at this zoom, so zooming out thins them
 * gradually instead of piling them up. A change of status is always kept, so the place where
 * someone crossed the border stays visible. Nothing is kept below DOT_MIN_ZOOM.
 */
export function spaceDots(dots: TrailDot[], zoom: number): TrailDot[] {
  if (zoom < DOT_MIN_ZOOM || dots.length === 0) return [];
  const kept = [dots[0]];
  for (let i = 1; i < dots.length; i++) {
    const last = kept[kept.length - 1];
    // Web Mercator: metres per screen pixel at this latitude and zoom (256 px tiles).
    const metersPerPixel = (156_543.03 * Math.cos((last.lat * Math.PI) / 180)) / 2 ** zoom;
    if (dots[i].status !== last.status || metersBetween(last, dots[i]) >= DOT_GAP_PX * metersPerPixel) {
      kept.push(dots[i]);
    }
  }
  return kept;
}

/**
 * Splits the path into runs of the same status and age, so Leaflet draws a handful of lines
 * instead of one per segment. Colour shows where the bracelet was inside, near or outside the
 * zone; fading shows which part is oldest.
 */
export function trailRuns(points: TrailPoint[]): TrailRun[] {
  const path = thinPoints(points);
  if (path.length < 2) return [];
  const ageOf = ageBuckets(path);

  const runs: TrailRun[] = [];
  for (let i = 1; i < path.length; i++) {
    const age = ageOf(path[i]);
    const status = path[i].status;
    const run = runs[runs.length - 1];
    if (run && run.status === status && run.age === age) {
      run.positions.push([path[i].lat, path[i].lng]);
    } else {
      runs.push({
        status,
        age,
        positions: [
          [path[i - 1].lat, path[i - 1].lng],
          [path[i].lat, path[i].lng],
        ],
      });
    }
  }
  return runs;
}

/** Opacity of a run: the oldest part is faint, the newest nearly solid. */
export function runOpacity(age: number): number {
  return 0.3 + (0.65 * age) / (AGE_BUCKETS - 1);
}
