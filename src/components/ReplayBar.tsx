"use client";

import { useEffect, useRef, useState } from "react";
import { FIX_STATUS_LABEL, STATUS_COLOR, formatDateTime, formatTime } from "@/lib/format";
import { pointIndexAt, REPLAY_SPEEDS, type ReplayRequest, type ReplaySpeed } from "@/lib/replay";
import type { ReplayPoint } from "@/lib/types";
import type { ReplayLoad } from "@/lib/use-replay";

/** How often playback moves the marker. Ten times a second looks smooth and keeps the map calm. */
const TICK_MS = 100;
/** One shared empty list, so "no points yet" doesn't count as a change on every render. */
const NO_POINTS: ReplayPoint[] = [];

interface Props {
  request: ReplayRequest;
  load: ReplayLoad;
  /** The cursor, as a time in ms. */
  at: number;
  onSeek: (at: number) => void;
  onClose: () => void;
  /** On a phone the bar only shows while the sheet is closed (the sheet covers the map). */
  phoneVisible: boolean;
}

const BUTTON =
  "min-h-10 squircle border border-line px-3 text-sm font-semibold text-ink hover:bg-ground disabled:opacity-50";

/**
 * Controls for a past path on the map: a slider through the reported positions, play and pause,
 * the speed, and what the bracelet reported at the cursor. Sits over the map, between the
 * page's sheet and the alert panel on a desktop, under the status card on a phone.
 */
export default function ReplayBar({ request, load, at, onSeek, onClose, phoneVisible }: Props) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(60);
  const points = load.state === "ready" ? load.path.points : NO_POINTS;
  const atRef = useRef(at);
  useEffect(() => {
    atRef.current = at;
  }, [at]);

  useEffect(() => {
    if (!playing || points.length === 0) return;
    const end = Date.parse(points[points.length - 1].recordedAt);
    let last = performance.now();
    const timer = setInterval(() => {
      const nowMs = performance.now();
      const next = atRef.current + (nowMs - last) * speed;
      last = nowMs;
      if (next >= end) {
        onSeek(end);
        setPlaying(false);
      } else {
        atRef.current = next;
        onSeek(next);
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, speed, points, onSeek]);

  const index = points.length > 0 ? pointIndexAt(points, at) : 0;
  const point = points[index];
  const atEnd = points.length > 0 && index === points.length - 1;

  function togglePlay() {
    // Playing from the last point starts over, like a video.
    if (!playing && atEnd) onSeek(Date.parse(points[0].recordedAt));
    setPlaying(!playing);
  }

  return (
    <section
      aria-label="Putar ulang jejak"
      className={`float-surface fixed inset-x-2 top-[8.75rem] z-[1100] rounded-2xl p-3 lg:inset-x-auto lg:top-auto lg:bottom-3 lg:left-[calc(min(46rem,100vw_-_23rem_-_2.25rem)_+_1.5rem)] lg:right-[24.5rem] ${
        phoneVisible ? "" : "hidden lg:block"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">
            {request.inmateName ?? "Tanpa penugasan"} · {request.deviceLabel}
          </p>
          <p className="text-sm text-ink-soft">
            {formatDateTime(request.from)} sampai {formatDateTime(request.to)}
          </p>
        </div>
        <button type="button" onClick={onClose} className={BUTTON}>
          Tutup
        </button>
      </div>

      {load.state === "loading" && <p className="mt-2 text-sm text-ink-soft">Memuat jejak…</p>}
      {load.state === "failed" && (
        <p className="mt-2 rounded-xl bg-alert-tint px-3 py-2 text-sm text-[#7f1212]">
          Jejak gagal dimuat. Tutup, lalu coba lagi.
        </p>
      )}
      {load.state === "ready" && points.length === 0 && (
        <p className="mt-2 text-sm text-ink">
          Tidak ada posisi tersimpan pada periode ini. Posisi lama dihapus otomatis (bawaannya setelah 90 hari).
        </p>
      )}

      {point && (
        <>
          <input
            type="range"
            min={0}
            max={points.length - 1}
            step={1}
            value={index}
            onChange={(e) => onSeek(Date.parse(points[Number(e.target.value)].recordedAt))}
            aria-label="Waktu"
            aria-valuetext={formatTime(point.recordedAt)}
            className="mt-3 block w-full accent-[#005de0]"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-pressed={playing}
              className="min-h-10 squircle bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              {playing ? "Jeda" : "Putar"}
            </button>
            <div role="group" aria-label="Kecepatan" className="flex gap-1">
              {REPLAY_SPEEDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={speed === value}
                  onClick={() => setSpeed(value)}
                  className={`h-10 squircle px-2 text-sm font-semibold ${
                    speed === value ? "bg-ground text-ink ring-1 ring-line" : "text-ink-soft hover:bg-ground"
                  }`}
                >
                  {value}×
                </button>
              ))}
            </div>
            <p className="ml-auto text-right text-sm">
              <span className="font-semibold text-ink">{formatTime(point.recordedAt)}</span>
              <br />
              <span className="font-semibold" style={{ color: STATUS_COLOR[point.status] }}>
                {FIX_STATUS_LABEL[point.status]}
              </span>
              {point.status !== "unassigned" && (point.distanceOutsideMeters ?? 0) > 0 && (
                // "Di luar zona, 33 m di luar zona" would repeat itself, so only the distance.
                <span className="text-ink-soft">, {Math.round(point.distanceOutsideMeters!)} m dari garis</span>
              )}
            </p>
          </div>
        </>
      )}

      {request.clipped && (
        <p className="mt-2 text-sm text-ink-soft">Periode ini lebih dari 24 jam; yang ditampilkan 24 jam saja.</p>
      )}
      {load.state === "ready" && load.path.truncated && (
        <p className="mt-2 text-sm text-ink-soft">
          Posisinya terlalu banyak; hanya bagian awal periode yang ditampilkan.
        </p>
      )}
    </section>
  );
}
