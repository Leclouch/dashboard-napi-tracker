"use client";

import type { ReactNode } from "react";
import { useShell } from "@/lib/live-context";
import BottomSheet, { type SheetStop } from "./BottomSheet";

const STOPS: readonly SheetStop[] = ["closed", "full"];

/**
 * The panel every page except the map opens over the map. On a phone it is a bottom sheet you
 * can drag shut, leaving only the map, the status card, the tab bar and the sheet's own handle.
 * On a desktop it is a fixed panel at the left.
 *
 * A closed sheet stays mounted, so a half-filled form is still there when it reopens.
 */
export default function PageSheet({ children }: { children: ReactNode }) {
  const { phoneSheet } = useShell();

  return (
    <BottomSheet
      stops={STOPS}
      stop={phoneSheet.closed ? "closed" : "full"}
      onStopChange={(next) => phoneSheet.setClosed(next === "closed")}
      topRem={9}
      className="lg:inset-auto lg:top-20 lg:bottom-3 lg:left-3 lg:h-auto lg:w-[min(46rem,calc(100vw-23rem-2.25rem))] lg:rounded-2xl lg:shadow-[0_1px_2px_rgb(11_31_63/0.1),0_8px_24px_rgb(11_31_63/0.14)]"
    >
      {/* The handle sits outside this scroller, so it never scrolls away. */}
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </BottomSheet>
  );
}
