"use client";

import { useEffect, useState } from "react";
import {
  EPISODE_LABEL,
  STATUS_COLOR,
  formatDateTime,
  formatDuration,
  wibDay,
} from "@/lib/format";
import { responseMs, summariseAlerts } from "@/lib/history";
import { alertsCsv, assignmentsCsv, csvFileName } from "@/lib/history-csv";
import { useShell } from "@/lib/live-context";
import { replayForAlert, replayForAssignment, type ReplayRequest } from "@/lib/replay";
import type { Assignment, Episode, EpisodeType } from "@/lib/types";
import PageSheet from "./PageSheet";
import StatusGlyph from "./StatusGlyph";

const DAY_MS = 24 * 60 * 60 * 1000;
/** The backend returns this many rows per request unless asked for more. */
const PAGE_LIMIT = 200;
/** What the export asks for: the backend's most per request. */
const EXPORT_LIMIT = 5000;

/** Hands a finished file to the browser's download. */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked a moment later: some browsers start reading the file only after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function matchesQuery(query: string, ...texts: (string | null | undefined)[]): boolean {
  return query === "" || texts.some((text) => text?.toLowerCase().includes(query));
}

/** The list and the export show the same rows: one filter for both. */
function filterAlerts(alerts: Episode[], type: EpisodeType | "all", query: string): Episode[] {
  return alerts.filter(
    (a) => (type === "all" || a.type === type) && matchesQuery(query, a.inmateName, a.guardName, a.deviceLabel),
  );
}

function filterAssignments(assignments: Assignment[], query: string): Assignment[] {
  return assignments.filter((a) => matchesQuery(query, a.inmateName, a.guardName, a.deviceLabel, a.zoneName));
}

function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`mt-2 ${SMALL_BUTTON}`}>
      Lihat jejak di peta
    </button>
  );
}

const INPUT =
  "mt-1 block h-12 w-full rounded-xl border border-line bg-white px-3 text-base font-normal text-ink";
const SMALL_BUTTON =
  "min-h-10 squircle border border-line px-3 text-sm font-semibold text-ink hover:bg-ground disabled:opacity-60";

const PRESETS = [
  { label: "Hari ini", days: 1 },
  { label: "7 hari", days: 7 },
  { label: "30 hari", days: 30 },
];

type Tab = "alerts" | "assignments";

/** Rows for one range. `items` is null when the request failed. */
interface Result<T> {
  key: string;
  items: T[] | null;
}

function Line({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-soft">{children}</p>;
}

function AlertItem({ alert, onReplay }: { alert: Episode; onReplay: () => void }) {
  const resolved = alert.resolvedAt !== null;
  const response = responseMs(alert);
  const opened = new Date(alert.triggeredAt).getTime();

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex items-center gap-2">
        <StatusGlyph status={alert.type} size={18} />
        <span className="font-bold" style={{ color: STATUS_COLOR[alert.type] }}>
          {EPISODE_LABEL[alert.type]}
        </span>
        <span className="ml-auto text-sm text-ink-soft">{alert.deviceLabel}</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-ink">
        {alert.inmateName ?? "Tidak ada penugasan"}
        {alert.guardName && <span className="font-normal text-ink-soft">, petugas {alert.guardName}</span>}
      </p>
      <Line>Mulai {formatDateTime(alert.triggeredAt)}</Line>
      {alert.escalatedAt && (
        <Line>
          Meningkat menjadi {EPISODE_LABEL[alert.type].toLowerCase()} pada {formatDateTime(alert.escalatedAt)}
        </Line>
      )}
      <Line>
        {resolved && alert.resolvedAt
          ? `Selesai ${formatDateTime(alert.resolvedAt)}, berlangsung ${formatDuration(
              new Date(alert.resolvedAt).getTime() - opened,
            )}`
          : "Masih terbuka"}
      </Line>
      {response !== null ? (
        <Line>
          Dilihat oleh {alert.acknowledgedByName ?? "staf"} pada {formatDateTime(alert.acknowledgedAt!)},{" "}
          {formatDuration(response)} setelah peringatan
        </Line>
      ) : (
        <p className="text-sm font-semibold text-[#b91c1c]">
          {resolved ? "Tidak pernah dilihat" : "Belum dilihat"}
        </p>
      )}
      <ReplayButton onClick={onReplay} />
    </li>
  );
}

function AssignmentItem({ assignment, onReplay }: { assignment: Assignment; onReplay: () => void }) {
  const started = new Date(assignment.startedAt).getTime();

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold text-ink">{assignment.inmateName}</span>
        <span className="text-sm text-ink-soft">{assignment.deviceLabel}</span>
      </div>
      <Line>
        Petugas {assignment.guardName}, zona {assignment.zoneName}
      </Line>
      <Line>
        Mulai {formatDateTime(assignment.startedAt)}
        {assignment.startedByName && `, oleh ${assignment.startedByName}`}
      </Line>
      {assignment.endedAt ? (
        <Line>
          Selesai {formatDateTime(assignment.endedAt)}, berlangsung{" "}
          {formatDuration(new Date(assignment.endedAt).getTime() - started)}
          {assignment.endedByName && `, oleh ${assignment.endedByName}`}
        </Line>
      ) : (
        <p className="text-sm font-semibold text-[#115c2d]">Masih berjalan</p>
      )}
      <ReplayButton onClick={onReplay} />
    </li>
  );
}

/** Past alerts and past assignments for a period, so an incident can be looked at afterwards. */
export default function HistorySheet() {
  const { live, now, replay } = useShell();
  const { api } = live;
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<{ text: string; failed: boolean } | null>(null);

  const [tab, setTab] = useState<Tab>("alerts");
  const [from, setFrom] = useState(() => wibDay(Date.now() - 6 * DAY_MS));
  const [to, setTo] = useState(() => wibDay(Date.now()));
  const [reload, setReload] = useState(0);
  const [typeFilter, setTypeFilter] = useState<EpisodeType | "all">("all");
  const [search, setSearch] = useState("");
  const [alerts, setAlerts] = useState<Result<Episode> | null>(null);
  const [assignments, setAssignments] = useState<Result<Assignment> | null>(null);

  const today = wibDay(now);
  // ISO dates sort the same as the days they name, so comparing the strings is enough.
  const rangeOk = from !== "" && to !== "" && from <= to;
  const rangeKey = `${from}|${to}`;

  useEffect(() => {
    if (!rangeOk) return;
    let cancelled = false;
    if (tab === "alerts") {
      api.alertHistory(from, to).then(
        (items) => {
          if (!cancelled) setAlerts({ key: rangeKey, items });
        },
        () => {
          if (!cancelled) setAlerts({ key: rangeKey, items: null });
        },
      );
    } else {
      api.assignmentHistory(from, to).then(
        (items) => {
          if (!cancelled) setAssignments({ key: rangeKey, items });
        },
        () => {
          if (!cancelled) setAssignments({ key: rangeKey, items: null });
        },
      );
    }
    return () => {
      cancelled = true;
    };
    // `reload` is only here so the refresh button can ask for the same range again.
  }, [api, tab, from, to, rangeOk, rangeKey, reload]);

  const result = tab === "alerts" ? alerts : assignments;
  const loading = rangeOk && result?.key !== rangeKey;
  const failed = rangeOk && result?.key === rangeKey && result.items === null;

  const query = search.trim().toLowerCase();
  const shownAlerts = filterAlerts((alerts?.key === rangeKey ? alerts.items : null) ?? [], typeFilter, query);
  const shownAssignments = filterAssignments(
    (assignments?.key === rangeKey ? assignments.items : null) ?? [],
    query,
  );
  const shownCount = tab === "alerts" ? shownAlerts.length : shownAssignments.length;
  const rawCount = (result?.key === rangeKey ? result.items?.length : 0) ?? 0;
  const summary = summariseAlerts(shownAlerts);

  /**
   * Fetches the period again with the export limit (the page holds at most 200), applies the
   * same search and type filter as the list, and downloads it.
   */
  async function exportCsv() {
    setExporting(true);
    setExportNote(null);
    try {
      let count: number;
      let fetched: number;
      if (tab === "alerts") {
        const items = await api.alertHistory(from, to, EXPORT_LIMIT);
        const rows = filterAlerts(items, typeFilter, query);
        download(csvFileName("peringatan", from, to), alertsCsv(rows));
        [count, fetched] = [rows.length, items.length];
      } else {
        const items = await api.assignmentHistory(from, to, EXPORT_LIMIT);
        const rows = filterAssignments(items, query);
        download(csvFileName("penugasan", from, to), assignmentsCsv(rows));
        [count, fetched] = [rows.length, items.length];
      }
      setExportNote({
        text:
          fetched >= EXPORT_LIMIT
            ? `${count} baris diunduh. Periode ini punya lebih dari ${EXPORT_LIMIT} data; hanya yang terbaru ikut. Persempit tanggal untuk sisanya.`
            : `${count} baris diunduh.`,
        failed: false,
      });
    } catch {
      setExportNote({ text: "File gagal dibuat. Coba lagi.", failed: true });
    } finally {
      setExporting(false);
    }
  }

  const startReplay = (request: ReplayRequest) => replay.start(request);

  return (
    <PageSheet>
      <div className="p-4 lg:p-6">
        <h2 className="text-2xl font-extrabold text-ink">Riwayat</h2>

        <div role="tablist" className="mt-4 flex gap-1">
          {(
            [
              ["alerts", "Peringatan"],
              ["assignments", "Penugasan"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`min-h-10 squircle px-4 text-sm font-semibold ${
                tab === value ? "bg-brand text-white" : "text-ink hover:bg-ground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {PRESETS.map(({ label, days }) => {
            const start = wibDay(now - (days - 1) * DAY_MS);
            const active = from === start && to === today;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setFrom(start);
                  setTo(today);
                }}
                className={`min-h-10 squircle border px-3 text-sm font-semibold ${
                  active ? "border-brand bg-brand text-white" : "border-line text-ink hover:bg-ground"
                }`}
              >
                {label}
              </button>
            );
          })}
          <button type="button" onClick={() => setReload((n) => n + 1)} className={SMALL_BUTTON}>
            Muat ulang
          </button>
          <button
            type="button"
            disabled={!rangeOk || exporting}
            onClick={() => void exportCsv()}
            className={SMALL_BUTTON}
          >
            {exporting ? "Membuat file…" : "Unduh CSV"}
          </button>
        </div>
        {exportNote && (
          <p
            role="status"
            className={`mt-2 rounded-xl px-4 py-2 text-sm ${
              exportNote.failed ? "bg-alert-tint text-[#7f1212]" : "bg-[#e3f4e8] text-[#115c2d]"
            }`}
          >
            {exportNote.text}
          </p>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-ink">
            Dari tanggal
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className={INPUT}
            />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Sampai tanggal
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className={INPUT}
            />
          </label>
        </div>
        <p className="mt-1 text-sm text-ink-soft">Tanggal menurut WIB, kedua hari ikut dihitung.</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "alerts" ? "Cari nama, petugas atau gelang" : "Cari nama, petugas, gelang atau zona"}
            aria-label="Cari"
            className="block h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
          />
          {tab === "alerts" && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EpisodeType | "all")}
              aria-label="Jenis peringatan"
              className="block h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
            >
              <option value="all">Semua jenis</option>
              <option value="alert">{EPISODE_LABEL.alert}</option>
              <option value="warn">{EPISODE_LABEL.warn}</option>
              <option value="signal_lost">{EPISODE_LABEL.signal_lost}</option>
            </select>
          )}
        </div>

        <div aria-live="polite" className="mt-4">
          {!rangeOk && (
            <p className="rounded-xl bg-warn-tint px-4 py-2 text-sm text-[#7a3a04]">
              Pilih tanggal awal dan akhir, dan tanggal awal tidak boleh setelah tanggal akhir.
            </p>
          )}
          {failed && (
            <p className="rounded-xl bg-alert-tint px-4 py-2 text-sm text-[#7f1212]">
              Riwayat gagal dimuat. Coba lagi dengan Muat ulang.
            </p>
          )}
          {loading && <p className="text-sm text-ink-soft">Memuat…</p>}
        </div>

        {rangeOk && !loading && !failed && (
          <>
            {tab === "alerts" && summary.total > 0 && (
              <div className="mt-2 rounded-xl bg-ground px-4 py-3 text-sm text-ink">
                <p className="font-semibold">
                  {summary.total} peringatan: {summary.byType.alert} {EPISODE_LABEL.alert.toLowerCase()},{" "}
                  {summary.byType.warn} {EPISODE_LABEL.warn.toLowerCase()}, {summary.byType.signal_lost}{" "}
                  {EPISODE_LABEL.signal_lost.toLowerCase()}
                </p>
                <p className="text-ink-soft">
                  {summary.averageResponseMs !== null
                    ? `Rata-rata dilihat ${formatDuration(summary.averageResponseMs)} setelah peringatan.`
                    : "Belum ada yang dilihat."}
                  {summary.unseen > 0 && ` ${summary.unseen} belum pernah dilihat.`}
                </p>
              </div>
            )}

            {rawCount >= PAGE_LIMIT && (
              <p className="mt-2 rounded-xl bg-warn-tint px-4 py-2 text-sm text-[#7a3a04]">
                Hanya {PAGE_LIMIT} terbaru yang ditampilkan. Persempit tanggal untuk melihat yang lebih
                lama, atau gunakan Unduh CSV (sampai {EXPORT_LIMIT} data).
              </p>
            )}

            <h3 className="mt-4 text-base font-bold text-ink">
              {tab === "alerts" ? "Peringatan" : "Penugasan"} ({shownCount})
            </h3>
            {shownCount === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">
                {rawCount === 0
                  ? "Tidak ada data pada periode ini."
                  : "Tidak ada yang cocok dengan pencarian atau jenis ini."}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {tab === "alerts"
                  ? shownAlerts.map((alert) => (
                      <AlertItem
                        key={alert.id}
                        alert={alert}
                        onReplay={() => startReplay(replayForAlert(alert, Date.now()))}
                      />
                    ))
                  : shownAssignments.map((assignment) => (
                      <AssignmentItem
                        key={assignment.id}
                        assignment={assignment}
                        onReplay={() => startReplay(replayForAssignment(assignment, Date.now()))}
                      />
                    ))}
              </ul>
            )}
          </>
        )}
      </div>
    </PageSheet>
  );
}
