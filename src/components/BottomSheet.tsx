"use client";

import {
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import SheetHandle from "./SheetHandle";

export type SheetStop = "closed" | "half" | "full";

/** Keep in step with --sheet-half in globals.css (42dvh) and coveredEdges in MapView. */
const HALF_RATIO = 0.42;
/** Closed: only the handle strip (h-9 in SheetHandle) stays, above the tab bar (h-16). */
const HANDLE_REM = 2.25;
const TAB_BAR_REM = 4;
/** A finger that moves less than this is still a tap. */
const TAP_SLOP_PX = 6;
/** Where the sheet would end up if it kept moving at the speed it was let go with. */
const MOMENTUM_MS = 200;

/** The CSS height of a stop. The sheet rests on these, so it follows the screen when it turns. */
function cssHeight(stop: SheetStop, topRem: number): string {
  if (stop === "closed") return `${HANDLE_REM}rem`;
  if (stop === "half") return "var(--sheet-half)";
  return `calc(100dvh - ${TAB_BAR_REM}rem - ${topRem}rem)`;
}

/** The same heights in pixels, for working out which stop a finger is nearest to. */
function pixelHeight(stop: SheetStop, topRem: number): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  if (stop === "closed") return HANDLE_REM * rem;
  if (stop === "half") return HALF_RATIO * window.innerHeight;
  return window.innerHeight - (TAB_BAR_REM + topRem) * rem;
}

const DESKTOP = "(min-width: 1024px)";

/** True on a desktop-sized screen, where there is no sheet to close. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(DESKTOP);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
}

interface Drag {
  startY: number;
  startHeight: number;
  height: number;
  lastY: number;
  lastTime: number;
  /** Pixels per millisecond, positive when moving up. Smoothed, since single moves are noisy. */
  velocity: number;
  moved: boolean;
  stopsPx: { stop: SheetStop; px: number }[];
}

interface Props {
  /** Smallest first, and always starting with "closed". */
  stops: readonly SheetStop[];
  stop: SheetStop;
  onStopChange: (stop: SheetStop) => void;
  /** Distance of the fully open sheet from the top of the screen, in rem. */
  topRem: number;
  /** How the sheet looks on a desktop, where it is no sheet (the handle is hidden there). */
  className?: string;
  children: ReactNode;
}

/**
 * A bottom sheet on a phone that follows the finger while it is dragged and, once let go, settles
 * on the nearest stop (a quick flick carries it further). A tap on the handle steps to the next
 * stop. While dragging, the height is written straight to the element, so nothing re-renders per
 * pointer move; the React state only changes when the sheet settles.
 *
 * When closed, only the handle stays. The content stays mounted (a half-filled form survives) but
 * is `inert`, so the keyboard and screen readers can't reach what is out of sight.
 */
export default function BottomSheet({ stops, stop, onStopChange, topRem, className = "", children }: Props) {
  const sheet = useRef<HTMLElement>(null);
  const drag = useRef<Drag | null>(null);
  /** A drag ends in a click on the handle; this tells that click to stand down. */
  const justDragged = useRef(false);
  const desktop = useIsDesktop();

  const top = stops.length - 1;
  const closed = stop === "closed";

  /** Closed opens to the next size up, the biggest goes down a size (or closes), the rest open fully. */
  function tapTarget(): SheetStop {
    const index = stops.indexOf(stop);
    if (index === 0) return stops[1];
    if (index === top) return stops.length > 2 ? stops[top - 1] : stops[0];
    return stops[top];
  }

  function settle(next: SheetStop) {
    // Pointing the height at the stop's own value lets the CSS transition carry the sheet there
    // from wherever the finger let go; the same value comes back from React a moment later.
    sheet.current?.style.setProperty("--sheet-h", cssHeight(next, topRem));
    if (next !== stop) onStopChange(next);
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    const element = sheet.current;
    if (!element || event.button !== 0) return;
    justDragged.current = false;
    const height = element.getBoundingClientRect().height;
    drag.current = {
      startY: event.clientY,
      startHeight: height,
      height,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      moved: false,
      stopsPx: stops.map((s) => ({ stop: s, px: pixelHeight(s, topRem) })),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    // No easing while the finger is down: the sheet must stick to it.
    element.style.transition = "none";
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dy = event.clientY - d.startY;
    if (!d.moved && Math.abs(dy) < TAP_SLOP_PX) return;
    d.moved = true;

    const lowest = d.stopsPx[0].px;
    const highest = d.stopsPx[d.stopsPx.length - 1].px;
    d.height = Math.min(highest, Math.max(lowest, d.startHeight - dy));
    sheet.current?.style.setProperty("--sheet-h", `${d.height}px`);

    const elapsed = event.timeStamp - d.lastTime;
    if (elapsed > 0) {
      d.velocity = 0.7 * d.velocity + 0.3 * ((d.lastY - event.clientY) / elapsed);
      d.lastY = event.clientY;
      d.lastTime = event.timeStamp;
    }
  }

  function finishDrag(cancelled: boolean) {
    const d = drag.current;
    drag.current = null;
    if (!d || !sheet.current) return;
    sheet.current.style.transition = "";

    if (!d.moved) {
      // A tap arrives as a click, which also covers keyboards and screen readers.
      if (cancelled) settle(stop);
      return;
    }
    justDragged.current = true;
    const projected = d.height + d.velocity * MOMENTUM_MS;
    const nearest = d.stopsPx.reduce((best, s) =>
      Math.abs(s.px - projected) < Math.abs(best.px - projected) ? s : best,
    );
    settle(nearest.stop);
  }

  function onClick() {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    settle(tapTarget());
  }

  const target = tapTarget();
  const label = closed
    ? "Buka panel"
    : target === stops[0]
      ? "Tutup panel"
      : stop === stops[top]
        ? "Kecilkan panel"
        : "Besarkan panel";

  return (
    <section
      ref={sheet}
      style={{ "--sheet-h": cssHeight(stop, topRem) } as CSSProperties}
      className={`fixed inset-x-0 bottom-16 z-[1050] flex h-(--sheet-h) flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-8px_24px_rgb(11_31_63/0.16)] transition-[height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${className}`}
    >
      <SheetHandle
        label={label}
        expanded={!closed}
        dragProps={{
          onPointerDown,
          onPointerMove,
          onPointerUp: () => finishDrag(false),
          onPointerCancel: () => finishDrag(true),
          onClick,
        }}
        onClose={closed ? undefined : () => settle(stops[0])}
      />
      <div inert={closed && !desktop} className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </section>
  );
}
