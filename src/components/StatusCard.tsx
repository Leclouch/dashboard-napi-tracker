"use client";

import { useShell } from "@/lib/live-context";
import type { BandTone, DisplayStatus, Situation, Tally } from "@/lib/status";
import type { Connection } from "@/lib/use-live-data";
import { LogoutButton, SoundButton } from "./NavBar";
import StatusGlyph from "./StatusGlyph";

/** Strip colour on the white card. Offline and urgent replace the whole card instead. */
const STRIP_CLASS: Record<BandTone, string> = {
  calm: "bg-[#15803d]",
  idle: "bg-[#8a97ab]",
  warn: "bg-[#fbbf24]",
  signal: "bg-[#5b6472]",
  alert: "bg-[#b91c1c]",
  offline: "bg-[#2b3240]",
};

const CONNECTION_TEXT: Record<Connection, string> = {
  connecting: "Menghubungkan…",
  online: "Terhubung langsung",
  offline: "Mencoba lagi…",
};

function TallyItem({ status, count, label }: { status: DisplayStatus; count: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span className={count === 0 ? "opacity-40" : ""}>
        <StatusGlyph status={status} size={20} />
      </span>
      <span className="text-lg leading-none font-bold tabular-nums">{count}</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

interface Props {
  situation: Situation;
  tally: Tally;
  /** True while an unacknowledged out-of-zone alert is open. */
  urgent: boolean;
}

/** The screen's headline. White while things are fine, fully red only when someone must act. */
export default function StatusCard({ situation, tally, urgent }: Props) {
  const { live } = useShell();
  const filledRed = urgent && situation.tone === "alert";
  const hazard = situation.tone === "offline";

  return (
    <section
      aria-live="polite"
      aria-label="Status gelang"
      className="float-surface pointer-events-auto overflow-hidden rounded-2xl"
    >
      {!filledRed && !hazard && <div className={`h-1.5 ${STRIP_CLASS[situation.tone]}`} />}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 ${
          filledRed ? "status-urgent text-white" : hazard ? "status-offline text-white" : "text-ink"
        }`}
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-lg leading-tight font-extrabold lg:text-xl">{situation.headline}</h1>
          <p className={`text-sm ${filledRed || hazard ? "text-white/85" : "text-ink-soft"}`}>
            {CONNECTION_TEXT[live.connection]}
          </p>
        </div>
        {/* On phones the navbar has no room for these, so they live on the card. */}
        <div className={`flex lg:hidden ${filledRed || hazard ? "squircle bg-white text-ink" : ""}`}>
          <SoundButton />
          <LogoutButton />
        </div>
      </div>
      <TallyRow tally={tally} />
    </section>
  );
}

function TallyRow({ tally }: { tally: Tally }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-line bg-white px-4 py-2 text-ink">
      <TallyItem status="alert" count={tally.alert} label="Di luar zona" />
      <TallyItem status="signal_lost" count={tally.signal_lost} label="Sinyal hilang" />
      <TallyItem status="warn" count={tally.warn} label="Dekat batas zona" />
      <TallyItem status="normal" count={tally.normal} label="Di dalam zona" />
      {tally.noPosition > 0 && (
        <TallyItem status="unassigned" count={tally.noPosition} label="Belum ada posisi" />
      )}
    </div>
  );
}
