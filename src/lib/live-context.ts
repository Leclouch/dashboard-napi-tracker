"use client";

import { createContext, useContext } from "react";
import type { useAlarm } from "./use-alarm";
import type { useLiveData } from "./use-live-data";
import type { Selection } from "./status";

export interface Shell {
  live: ReturnType<typeof useLiveData>;
  alarm: ReturnType<typeof useAlarm>;
  /** Clock for "x menit lalu" texts, ticks every few seconds. */
  now: number;
  selection: Selection | null;
  select: (braceletId: number) => void;
  logout: () => void;
}

/** Everything the pages share. AppShell owns it, so it survives moving between pages. */
export const ShellContext = createContext<Shell | null>(null);

export function useShell(): Shell {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("useShell must be used inside AppShell");
  return shell;
}
