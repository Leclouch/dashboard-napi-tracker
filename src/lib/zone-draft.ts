// Pure rules for drawing a zone on the map. No React, no Leaflet.
// Corners are GeoJSON order [lng, lat], like the backend. The draft keeps the ring OPEN (the first
// corner is not repeated at the end); `toBoundary` closes it for the backend.

import type { ZoneBoundary } from "./types";

export type Corner = [number, number];

/** A zone being drawn: which zone it replaces (null for a new one), its corners, and undo steps. */
export interface ZoneDraft {
  zoneId: number | null;
  corners: Corner[];
  /** Earlier versions of `corners`, newest last. */
  history: Corner[][];
}

/** The fewest corners a polygon can have. */
export const MIN_CORNERS = 3;

/** 7 decimals is about 1 cm: more is noise, and it keeps the audit log readable. */
function round(value: number): number {
  return Math.round(value * 1e7) / 1e7;
}

export function corner(lng: number, lat: number): Corner {
  return [round(lng), round(lat)];
}

/** Opens a zone's closed ring for editing. */
export function draftFromBoundary(zoneId: number | null, boundary: ZoneBoundary | null): ZoneDraft {
  const ring = boundary?.coordinates[0] ?? [];
  const corners = ring.slice(0, -1).map(([lng, lat]) => corner(lng, lat));
  return { zoneId, corners, history: [] };
}

/** Closes the ring again, as the backend wants it. */
export function toBoundary(corners: Corner[]): ZoneBoundary {
  return { type: "Polygon", coordinates: [[...corners, corners[0]]] };
}

/** Same corners in the same order. */
export function sameCorners(a: Corner[], b: Corner[]): boolean {
  return a.length === b.length && a.every(([lng, lat], i) => lng === b[i][0] && lat === b[i][1]);
}

/** A change that can be undone. */
function withCorners(draft: ZoneDraft, corners: Corner[]): ZoneDraft {
  return { ...draft, corners, history: [...draft.history, draft.corners] };
}

/** Starts the outline over, e.g. to redraw a placeholder from scratch. Undo brings it back. */
export function clearCorners(draft: ZoneDraft): ZoneDraft {
  return draft.corners.length === 0 ? draft : withCorners(draft, []);
}

export function undo(draft: ZoneDraft): ZoneDraft {
  if (draft.history.length === 0) return draft;
  return {
    ...draft,
    corners: draft.history[draft.history.length - 1],
    history: draft.history.slice(0, -1),
  };
}

/**
 * Distance from p to the segment a-b, squared, in a flat projection. Around Sleman a degree of
 * longitude is shorter than one of latitude, so longitude is scaled by cos(latitude); without
 * that, "nearest edge" would favour east-west edges.
 */
function segmentDistance2(p: Corner, a: Corner, b: Corner): number {
  const scale = Math.cos((p[1] * Math.PI) / 180);
  const [px, py, ax, ay, bx, by] = [p[0] * scale, p[1], a[0] * scale, a[1], b[0] * scale, b[1]];
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
  const cx = ax + t * dx - px;
  const cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}

/**
 * Adds a corner where a click lands: into the nearest edge. While drawing a new zone round its
 * edge, the nearest edge is usually the closing one (last corner back to the first), so it acts
 * like adding at the end; when reshaping a zone, a click beside an edge bends that edge.
 */
export function addCorner(draft: ZoneDraft, point: Corner): ZoneDraft {
  const { corners } = draft;
  if (corners.length < MIN_CORNERS) return withCorners(draft, [...corners, point]);

  let best = corners.length - 1;
  let bestDistance = Infinity;
  for (let i = 0; i < corners.length; i++) {
    const distance = segmentDistance2(point, corners[i], corners[(i + 1) % corners.length]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return withCorners(draft, [...corners.slice(0, best + 1), point, ...corners.slice(best + 1)]);
}

/** Removing a corner is refused when it would leave less than a triangle. */
export function removeCorner(draft: ZoneDraft, index: number): ZoneDraft {
  if (draft.corners.length <= MIN_CORNERS) return draft;
  return withCorners(draft, draft.corners.filter((_, i) => i !== index));
}

/**
 * Moves a corner while it is dragged. Only the first move of a drag is recorded, so one undo
 * puts the corner back where the drag started instead of stepping back pixel by pixel.
 */
export function moveCorner(draft: ZoneDraft, index: number, point: Corner, startOfDrag: boolean): ZoneDraft {
  const corners = draft.corners.map((c, i) => (i === index ? point : c));
  return startOfDrag ? withCorners(draft, corners) : { ...draft, corners };
}

/** Wording of the backend's 400 for a bad shape, e.g. "boundary is not a valid polygon: Self-intersection". */
export function shapeProblem(message: string): string | null {
  if (/self-intersection/i.test(message)) {
    return "Garis batas saling bersilangan. Geser titik sampai tidak ada garis yang memotong garis lain.";
  }
  if (/valid polygon|ring|positions/i.test(message)) {
    return "Bentuk zona tidak sah. Periksa titik-titiknya.";
  }
  return null;
}
