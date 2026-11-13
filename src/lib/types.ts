// Shapes of the backend's JSON (backend-napi-tracker). Dates arrive as ISO 8601 strings.
// Keep in sync with the backend: src/fixes/fixes-query.repository.ts, src/alerts/alerts.repository.ts,
// src/alerts/episode-events.ts, src/assignments/assignments.repository.ts, src/zones/,
// src/bracelets/, src/auth/, src/accounts/ and the live events in src/live/live-events.ts.

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

/** One position on a bracelet's path (backend: TrailPoint in fixes-query.repository.ts). */
export interface TrailPoint {
  lat: number;
  lng: number;
  status: FixStatus;
  recordedAt: string;
}

/** A bracelet's recent path, oldest point first. */
export interface Trail {
  braceletId: number;
  deviceLabel: string;
  points: TrailPoint[];
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
  acknowledgedBy: number | null;
  /** Null when nobody has, or it happened before staff accounts existed. */
  acknowledgedByName: string | null;
  /** Who held the bracelet when this opened. Only on lists (GET /alerts), not on pushed events. */
  inmateName?: string | null;
  guardName?: string | null;
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
  /** Null for assignments from before staff accounts existed. */
  startedByName: string | null;
  endedByName: string | null;
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
/** Backend: src/settings/settings.types.ts. Seconds between reports, and alarm timing. */
export interface Settings {
  intervals: { normal: number; warn: number; alert: number; unassigned: number };
  /** signal_lost opens after this many missed reports. */
  signalLostMultiplier: number;
  /** Consecutive reports needed to open, escalate and resolve an alert. */
  debounce: { open: number; escalate: number; resolve: number };
  updatedAt: string;
}

/** What PUT /settings takes: only the fields that change. */
export interface SettingsPatch {
  intervals?: Partial<Settings["intervals"]>;
  signalLostMultiplier?: number;
  debounce?: Partial<Settings["debounce"]>;
}

/** Which list a person belongs to: the backend's /inmates or /guards. */
export type PersonKind = "inmates" | "guards";

export interface Person {
  id: number;
  name: string;
  /** Inactive people (released, left) stay in the history but can't start a new assignment. */
  status: "active" | "inactive";
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

export type StaffRole = "superadmin" | "staff";

/** The logged in person (GET /auth/me). */
export interface Me {
  id: number;
  email: string;
  displayName: string;
  role: StaffRole;
  guardId: number | null;
  expiresAt: string;
}

export type LoginStep =
  | { next: "done" }
  | { next: "code"; challenge: string; canRemember: boolean };

export type AccountStatus = "invited" | "active" | "disabled";

export interface StaffAccount {
  id: number;
  email: string;
  displayName: string;
  role: StaffRole;
  guardId: number | null;
  guardName: string | null;
  status: AccountStatus;
  createdAt: string;
}

export interface NewAccount {
  email: string;
  displayName: string;
  role: StaffRole;
  guardId: number | null;
}

/** The link only comes back when the email failed, to pass on by hand. */
export interface LinkDelivery {
  sent: boolean;
  link?: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  actorId: number | null;
  actorLabel: string;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
}

/** Events pushed on the /live Socket.IO namespace. */
export interface ServerToClientEvents {
  fix: (fix: Fix) => void;
  episode: (transition: EpisodeTransition) => void;
  alert_acknowledged: (episode: Episode) => void;
  assignment: (change: { kind: "started" | "ended"; assignment: Assignment }) => void;
}
