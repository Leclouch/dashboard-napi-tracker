import type { EpisodeType, FixStatus } from "./types";

// All text the staff read is Bahasa Indonesia; times are WIB (Asia/Jakarta).

export const FIX_STATUS_LABEL: Record<FixStatus, string> = {
  normal: "Di dalam zona",
  warn: "Dekat batas zona",
  alert: "Di luar zona",
  unassigned: "Tidak bertugas",
};

export const EPISODE_LABEL: Record<EpisodeType, string> = {
  warn: "Dekat batas zona",
  alert: "Di luar zona",
  signal_lost: "Sinyal hilang",
};

/** Label colours per status, dark enough to read on the tinted alert cards. Dots: globals.css. */
export const STATUS_COLOR: Record<FixStatus | EpisodeType, string> = {
  normal: "#15803d",
  warn: "#9a4a06",
  alert: "#b91c1c",
  signal_lost: "#5b6472",
  unassigned: "#5b6472",
};

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** "14.05.09 WIB" */
export function formatTime(iso: string): string {
  return `${timeFormat.format(new Date(iso))} WIB`;
}

/** "29 Okt 14.05 WIB" */
export function formatDateTime(iso: string): string {
  return `${dateTimeFormat.format(new Date(iso))} WIB`;
}

/** "baru saja", "3 menit lalu", "2 jam lalu" */
export function formatAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return "baru saja";
  if (seconds < 60) return `${seconds} detik lalu`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

/** "33 m di luar zona", or null inside the zone. */
export function formatDistance(meters: number | null): string | null {
  if (meters === null || meters <= 0) return null;
  return `${Math.round(meters)} m di luar zona`;
}
