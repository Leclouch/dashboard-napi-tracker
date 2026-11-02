"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

/** How far a finger must travel before it counts as a swipe rather than a tap. */
const SWIPE_PX = 24;

/** Bottom sheet with two stops, half and full. Tap the handle or swipe it. */
export default function PhoneSheet({ children }: { children: ReactNode }) {
  const [full, setFull] = useState(false);
  const startY = useRef<number | null>(null);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    startY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (startY.current === null) return;
    const moved = event.clientY - startY.current;
    startY.current = null;
    if (moved < -SWIPE_PX) setFull(true);
    else if (moved > SWIPE_PX) setFull(false);
    else setFull((current) => !current);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setFull((current) => !current);
  }

  return (
    <section
      className={`fixed inset-x-0 bottom-16 z-[1050] flex flex-col rounded-t-3xl bg-white shadow-[0_-8px_24px_rgb(11_31_63/0.16)] transition-[height] duration-200 motion-reduce:transition-none lg:hidden ${
        full ? "h-[calc(100dvh-4rem-7.5rem)]" : "h-[var(--sheet-half)]"
      }`}
    >
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        aria-expanded={full}
        aria-label={full ? "Kecilkan daftar" : "Besarkan daftar"}
        className="flex h-6 shrink-0 touch-none items-center justify-center"
      >
        <span className="h-1.5 w-12 rounded-full bg-line" />
      </button>
      {children}
    </section>
  );
}
