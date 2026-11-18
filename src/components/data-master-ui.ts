// Shared by the Data master tabs (DataMasterSheet, ZonesTab, BraceletsTab).

import { ApiError } from "@/lib/api";

export const INPUT =
  "mt-1 block h-12 w-full rounded-xl border border-line bg-white px-3 text-base font-normal text-ink";
export const SMALL_BUTTON =
  "min-h-10 squircle border border-line px-3 text-sm font-semibold text-ink hover:bg-ground disabled:opacity-60";
export const PRIMARY_BUTTON =
  "min-h-12 w-full squircle bg-brand px-4 font-bold text-white hover:bg-brand-dark disabled:opacity-50 md:w-auto";
export const SMALL_PRIMARY_BUTTON =
  "min-h-10 squircle bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60";
export const DANGER_BUTTON =
  "min-h-10 squircle bg-[#b91c1c] px-4 text-sm font-semibold text-white hover:bg-[#8f1414] disabled:opacity-60";

/** Shows a result at the top of the sheet: a message, or (with `failed`) an error. */
export type Report = (message: string | null, failed?: string) => void;

/** An error in words. A 409 gets the caller's own explanation; a 403 means "not a superadmin". */
export function errorText(error: unknown, conflict?: string): string {
  if (conflict && error instanceof ApiError && error.status === 409) return conflict;
  if (error instanceof ApiError && error.status === 403) return "Hanya superadmin yang bisa melakukan ini.";
  return error instanceof Error ? error.message : "Terjadi kesalahan";
}
