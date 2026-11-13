"use client";

import { useState, type ReactNode } from "react";
import BottomSheet, { type SheetStop } from "./BottomSheet";

const STOPS: readonly SheetStop[] = ["closed", "half", "full"];

interface Props {
  children: ReactNode;
  /** Closed all the way: only the handle stays, docked above the tab bar. */
  closed: boolean;
  onOpen: () => void;
  onClose: () => void;
}

/**
 * The map page's list on a phone, with three stops: closed, half and full. Drag the handle and
 * it settles on the nearest one; tap it to step up. It comes back from closed at half height,
 * the stop that keeps the map in view. Hidden on a desktop, where the list is a side panel.
 */
export default function PhoneSheet({ children, closed, onOpen, onClose }: Props) {
  const [full, setFull] = useState(false);
  const stop: SheetStop = closed ? "closed" : full ? "full" : "half";

  function onStopChange(next: SheetStop) {
    if (next === "closed") {
      setFull(false);
      onClose();
      return;
    }
    setFull(next === "full");
    if (closed) onOpen();
  }

  return (
    <BottomSheet stops={STOPS} stop={stop} onStopChange={onStopChange} topRem={7.5} className="lg:hidden">
      {children}
    </BottomSheet>
  );
}
