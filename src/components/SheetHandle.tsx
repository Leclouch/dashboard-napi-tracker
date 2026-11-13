"use client";

import type { ButtonHTMLAttributes } from "react";
import { ChevronIcon } from "./Icons";

interface Props {
  /** What the handle does for a screen reader, e.g. "Besarkan panel". */
  label: string;
  expanded: boolean;
  /** The drag and tap handlers from BottomSheet; this component only draws the strip. */
  dragProps: ButtonHTMLAttributes<HTMLButtonElement>;
  /** The explicit way down, for people who don't find the swipe. Left out when already closed. */
  onClose?: () => void;
}

/**
 * The strip at the top of every phone sheet. It is also what stays on screen, docked above the
 * tab bar, when the sheet is closed. The arrow is a real button because a drag is easy to miss
 * and impossible with a keyboard.
 */
export default function SheetHandle({ label, expanded, dragProps, onClose }: Props) {
  return (
    <div className="relative flex h-9 shrink-0 items-center lg:hidden">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={label}
        {...dragProps}
        // touch-none: the browser must not scroll the page while a finger drags the sheet.
        className="flex h-full flex-1 touch-none items-center justify-center select-none"
      >
        <span className="h-1.5 w-12 rounded-full bg-line" />
      </button>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup panel"
          title="Tutup panel"
          className="absolute top-0 right-1 flex h-9 w-11 items-center justify-center squircle text-ink hover:bg-ground"
        >
          <ChevronIcon open />
        </button>
      )}
    </div>
  );
}
