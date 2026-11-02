// Shapes of the backend's JSON (backend-napi-tracker). Dates arrive as ISO 8601 strings.
// Keep in sync with the backend: src/fixes/fixes-query.repository.ts, src/alerts/alerts.repository.ts,
// src/alerts/episode-events.ts, src/assignments/assignments.repository.ts, src/zones/,
// src/bracelets/ and the live events in src/live/live-events.ts.

export type FixStatus = "normal" | "warn" | "alert" | "unassigned";
export type EpisodeType = "warn" | "alert" | "signal_lost";

export interface Fix {
  id: number;
  braceletId: number;
  deviceLabel: string;
  zoneId: number | null;
  lat: number;
  lng: number;
  status: FixStatus;
  distanceOutsideMeters: number | null;
  hdop: number | null;
  sats: number | null;
  reportIntervalS: number | null;
  recordedAt: string;
  receivedAt: string;
}

export interface Episode {
  id: number;
  braceletId: number;
  deviceLabel?: string;
  locationFixId: number | null;
  type: EpisodeType;
  triggeredAt: string;
  escalatedAt: string | null;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
}

export interface EpisodeTransition {
  kind: "opened" | "escalated" | "resolved";
  episodeId: number;
  braceletId: number;
  deviceLabel: string;
  type: EpisodeType;
  previousType?: EpisodeType;
  fixId: number | null;
  at: string;
  triggeredAt?: string;
  silentSeconds?: number;
  reason?: "assignment_ended";
}

export interface Assignment {
  id: number;
  braceletId: number;
  deviceLabel: string;
  inmateId: number;
  inmateName: string;
  guardId: number;
  guardName: string;
  zoneId: number;
  zoneName: string;
  startedAt: string;
  endedAt: string | null;
}

export interface NewAssignment {
  braceletId: number;
  inmateId: number;
  guardId: number;
  zoneId: number;
}

export interface Bracelet {
  id: number;
  deviceLabel: string;
  status: string;
  createdAt: string;
  openAssignmentId: number | null;
  lastFixAt: string | null;
}

/** An inmate or a guard; both have the same shape in the backend. */
export interface Person {
  id: number;
  name: string;
  status: string;
  createdAt: string;
}

/** GeoJSON Polygon: coordinates are [lng, lat]. Leaflet wants [lat, lng]. */
export interface Zone {
  id: number;
  name: string;
  boundary: { type: "Polygon"; coordinates: [number, number][][] };
  warnMeters: number;
  alertMeters: number;
  createdAt: string;
}

/** Events pushed on the /live Socket.IO namespace. */
export interface ServerToClientEvents {
  fix: (fix: Fix) => void;
  episode: (transition: EpisodeTransition) => void;
  alert_acknowledged: (episode: Episode) => void;
  assignment: (change: { kind: "started" | "ended"; assignment: Assignment }) => void;
}
