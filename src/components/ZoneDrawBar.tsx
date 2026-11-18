"use client";

import { MIN_CORNERS, undo, type ZoneDraft } from "@/lib/zone-draft";

interface Props {
  draft: ZoneDraft;
  onChange: (draft: ZoneDraft) => void;
  /** Back to the form (reopens the sheet). */
  onDone: () => void;
}

/**
 * On a phone the page's sheet covers the map, so drawing happens with the sheet closed and this
 * bar over the map holds what the form would. A desktop keeps the form beside the map instead.
 */
export default function ZoneDrawBar({ draft, onChange, onDone }: Props) {
  const count = draft.corners.length;
  return (
    <div className="float-surface fixed inset-x-2 top-[8.75rem] z-[1100] rounded-2xl p-3 lg:hidden">
      <p className="text-sm text-ink">
        <span className="font-bold">{count} titik.</span>{" "}
        {count < MIN_CORNERS
          ? `Ketuk peta untuk menambah titik (minimal ${MIN_CORNERS}).`
          : "Ketuk peta untuk menambah titik, geser titik untuk memindahkan, ketuk titik untuk menghapus."}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={draft.history.length === 0}
          onClick={() => onChange(undo(draft))}
          className="min-h-10 squircle border border-line px-3 text-sm font-semibold text-ink hover:bg-ground disabled:opacity-50"
        >
          Urungkan
        </button>
        <button
          type="button"
          onClick={onDone}
          className="ml-auto min-h-10 squircle bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Kembali ke formulir
        </button>
      </div>
    </div>
  );
}
