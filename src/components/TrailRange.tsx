"use client";

import { TRAIL_OPTIONS, type TrailMinutes } from "@/lib/use-trail";

interface Props {
  value: TrailMinutes;
  onChange: (minutes: TrailMinutes) => void;
}

/** How far back the selected person's trail reaches. Sits on the map, under the navbar. */
export default function TrailRange({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Panjang jejak"
      className="float-surface fixed top-[8.75rem] left-2 z-[1100] flex items-center gap-1 rounded-full p-1 lg:top-[4.75rem] lg:left-3"
    >
      <span className="pr-1 pl-3 text-sm font-semibold text-ink-soft">Jejak</span>
      {TRAIL_OPTIONS.map((minutes) => (
        <button
          key={minutes}
          type="button"
          aria-pressed={minutes === value}
          onClick={() => onChange(minutes)}
          className={`h-8 rounded-full px-3 text-sm font-bold ${
            minutes === value ? "bg-brand text-white" : "text-ink hover:bg-ground"
          }`}
        >
          {minutes / 60} jam
        </button>
      ))}
    </div>
  );
}
