// Riwayat as a CSV file for Excel. Pure: rows in, text out.
//
// Excel with Indonesian settings splits columns on ";" (the comma is its decimal mark) and only
// reads UTF-8 when the file starts with a byte order mark, so both are used. Times are WIB.

import { EPISODE_LABEL } from "./format";
import { responseMs } from "./history";
import type { Assignment, Episode } from "./types";

type Cell = string | number | null;

/** "2026-11-18 08:05:09" in WIB: a form Excel reads as a date and time in any locale. */
const stamp = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function wibStamp(iso: string | null | undefined): string | null {
  return iso ? stamp.format(new Date(iso)) : null;
}

/** Minutes with one decimal and a comma, as Indonesian Excel expects: "12,5". */
function minutes(ms: number | null): string | null {
  if (ms === null) return null;
  return (Math.round(ms / 6000) / 10).toFixed(1).replace(".", ",");
}

function between(start: string, end: string | null): number | null {
  return end ? Math.max(0, Date.parse(end) - Date.parse(start)) : null;
}

/**
 * One cell. Quoted when it holds the separator, a quote or a line break. Text that Excel would
 * run as a formula (starting with = + - @, or a tab or carriage return) gets a leading
 * apostrophe, so a name typed as "=HYPERLINK(...)" stays text in the spreadsheet.
 */
function cell(value: Cell): string {
  if (value === null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The whole file: byte order mark, header, rows, Windows line ends. */
export function toCsv(header: string[], rows: Cell[][]): string {
  const lines = [header, ...rows].map((row) => row.map(cell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function alertsCsv(alerts: Episode[]): string {
  return toCsv(
    [
      "ID",
      "Jenis",
      "Gelang",
      "Warga binaan",
      "Petugas",
      "Mulai (WIB)",
      "Meningkat (WIB)",
      "Selesai (WIB)",
      "Durasi (menit)",
      "Dilihat oleh",
      "Dilihat (WIB)",
      "Waktu sampai dilihat (menit)",
    ],
    alerts.map((a) => [
      a.id,
      EPISODE_LABEL[a.type],
      a.deviceLabel ?? null,
      a.inmateName ?? null,
      a.guardName ?? null,
      wibStamp(a.triggeredAt),
      wibStamp(a.escalatedAt),
      wibStamp(a.resolvedAt),
      minutes(between(a.triggeredAt, a.resolvedAt)),
      a.acknowledgedAt ? (a.acknowledgedByName ?? "staf") : null,
      wibStamp(a.acknowledgedAt),
      minutes(responseMs(a)),
    ]),
  );
}

export function assignmentsCsv(assignments: Assignment[]): string {
  return toCsv(
    [
      "ID",
      "Warga binaan",
      "Gelang",
      "Petugas",
      "Zona",
      "Mulai (WIB)",
      "Dimulai oleh",
      "Selesai (WIB)",
      "Diakhiri oleh",
      "Durasi (menit)",
    ],
    assignments.map((a) => [
      a.id,
      a.inmateName,
      a.deviceLabel,
      a.guardName,
      a.zoneName,
      wibStamp(a.startedAt),
      a.startedByName,
      wibStamp(a.endedAt),
      a.endedByName,
      minutes(between(a.startedAt, a.endedAt)),
    ]),
  );
}

/** "riwayat-peringatan_2026-11-13_sd_2026-11-19.csv" */
export function csvFileName(kind: "peringatan" | "penugasan", from: string, to: string): string {
  return `riwayat-${kind}_${from}_sd_${to}.csv`;
}
