"use client";

import { createContext, useContext } from "react";
import type { useAlarm } from "./use-alarm";
import type { useLiveData } from "./use-live-data";
import type { Selection } from "./status";
import type { Me } from "./types";
import type { ZoneDraft } from "./zone-draft";
import type { ReplayRequest } from "./replay";

export interface Shell {
  live: ReturnType<typeof useLiveData>;
  alarm: ReturnType<typeof useAlarm>;
  /** Clock for "x menit lalu" texts, ticks every few seconds. */
  now: number;
  selection: Selection | null;
  select: (braceletId: number) => void;
  me: Me;
  openAccountMenu: () => void;
  /**
   * The panel over the map on a phone (the list on the map page, or the sheet of any other page).
   * Closed means only the map, the status card and the tab bar show.
   */
  phoneSheet: { closed: boolean; setClosed: (closed: boolean) => void };
  /**
   * The zone being drawn on the Zona tab. It lives here because the map draws it; leaving the
   * page drops it. null when nothing is being drawn.
   */
  zoneDraft: { draft: ZoneDraft | null; set: (draft: ZoneDraft | null) => void };
  /**
   * A past path being replayed on the map, started from Riwayat. Leaving the page stops it.
   * Starting one closes the phone's sheet, so the map shows.
   */
  replay: { request: ReplayRequest | null; start: (request: ReplayRequest) => void; stop: () => void };
}

/** Everything the pages share. AppShell owns it, so it survives moving between pages. */
export const ShellContext = createContext<Shell | null>(null);

export function useShell(): Shell {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("useShell must be used inside AppShell");
  return shell;
}
