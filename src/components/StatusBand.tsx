"use client";

import type { Connection } from "@/lib/use-live-data";
import type { BandTone, DisplayStatus, Situation, Tally } from "@/lib/status";
import StatusGlyph from "./StatusGlyph";

const TONE_CLASS: Record<BandTone, string> = {
  calm: "bg-ink text-white",
  idle: "bg-ink-soft text-white",
  warn: "bg-[#f2b233] text-ink",
  signal: "bg-[#5b21b6] text-white",
  alert: "bg-[#b91c1c] text-white",
  offline: "band-offline text-white",
};

const CONNECTION_TEXT: Record<Connection, string> = {
  connecting: "Menghubungkan…",
  online: "Langsung",
  offline: "Terputus, mencoba lagi…",
};

function TallyItem({ status, count, label }: { status: DisplayStatus; count: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={count === 0 ? "opacity-40" : ""}>
        <StatusGlyph status={status} size={22} />
      </span>
      <div>
        <div className="text-2xl leading-none font-bold tabular-nums">{count}</div>
        <div className="text-sm leading-tight text-ink-soft">{label}</div>
      </div>
    </div>
  );
}

interface Props {
  situation: Situation;
  tally: Tally;
  connection: Connection;
  /** True while an unacknowledged out-of-zone alert is open. */
  pulsing: boolean;
  alarm: { muted: boolean; blocked: boolean; toggle: () => void };
  onLogout: () => void;
}

/** The screen's headline: readable from across the room, and its colour is the worst status. */
export default function StatusBand({ situation, tally, connection, pulsing, alarm, onLogout }: Props) {
  const toolClass = "min-h-9 rounded border px-3 text-sm font-medium hover:bg-ground";
  return (
    <header className="flex flex-col border-b border-line bg-white lg:flex-row">
      <div
        aria-live="polite"
        className={`flex min-w-0 flex-1 flex-col justify-center px-4 py-3 ${TONE_CLASS[situation.tone]} ${
          pulsing && situation.tone === "alert" ? "band-pulse" : ""
        }`}
      >
        <h1 className="text-2xl leading-tight font-bold lg:text-4xl">{situation.headline}</h1>
        <p className="text-sm opacity-90">Gelang GPS, Lapas Cebongan</p>
      </div>

      <div className="flex flex-col justify-center gap-2 px-4 py-2 lg:w-[34rem] lg:flex-none">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <TallyItem status="alert" count={tally.alert} label="Di luar zona" />
          <TallyItem status="signal_lost" count={tally.signal_lost} label="Sinyal hilang" />
          <TallyItem status="warn" count={tally.warn} label="Dekat batas" />
          <TallyItem status="normal" count={tally.normal} label="Di dalam zona" />
          {tally.noPosition > 0 && (
            <TallyItem status="unassigned" count={tally.noPosition} label="Belum ada posisi" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-sm text-ink-soft">{CONNECTION_TEXT[connection]}</span>
          <button
            type="button"
            onClick={alarm.toggle}
            aria-pressed={!alarm.muted}
            className={`${toolClass} ${
              !alarm.muted && alarm.blocked
                ? "border-[#9a4a06] bg-warn-tint text-[#7a3a04]"
                : "border-line text-ink"
            }`}
          >
            {alarm.muted ? "Suara mati" : alarm.blocked ? "Klik untuk aktifkan suara" : "Suara nyala"}
          </button>
          <button type="button" onClick={onLogout} className={`${toolClass} border-line text-ink`}>
            Keluar
          </button>
        </div>
      </div>
    </header>
  );
}
