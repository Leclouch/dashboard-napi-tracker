import type { Settings, SettingsPatch } from "./types";

// Pure rules for the Pengaturan page: which fields exist, their limits, and how a form turns
// into the smallest patch to send. The limits mirror the backend (settings.types.ts and the
// CHECK constraints in migration 003); the backend stays the one that enforces them.

export type FieldId =
  | "interval.normal"
  | "interval.warn"
  | "interval.alert"
  | "interval.unassigned"
  | "signalLost"
  | "debounce.open"
  | "debounce.escalate"
  | "debounce.resolve";

export interface FieldSpec {
  id: FieldId;
  label: string;
  unit: string;
  help: string;
  min: number;
  max: number;
}

const INTERVAL = { min: 2, max: 600, unit: "detik" };

export const INTERVAL_FIELDS: FieldSpec[] = [
  { id: "interval.normal", label: "Di dalam zona", help: "Kondisi aman.", ...INTERVAL },
  { id: "interval.warn", label: "Dekat batas zona", help: "Dekat batas, belum keluar.", ...INTERVAL },
  { id: "interval.alert", label: "Di luar zona", help: "Sudah keluar dari zona.", ...INTERVAL },
  {
    id: "interval.unassigned",
    label: "Tidak bertugas",
    help: "Gelang yang tidak sedang dipakai.",
    ...INTERVAL,
  },
];

export const SIGNAL_FIELD: FieldSpec = {
  id: "signalLost",
  label: "Sinyal dianggap hilang setelah",
  unit: "laporan terlewat",
  help: "Peringatan Sinyal hilang muncul jika gelang tidak memberi kabar selama sejumlah laporan.",
  min: 2,
  max: 20,
};

const COUNT = { min: 1, max: 20 };

export const ALARM_FIELDS: FieldSpec[] = [
  {
    id: "debounce.open",
    label: "Peringatan dibuka setelah",
    unit: "laporan berturut-turut tidak aman",
    help: "Satu laporan yang meleset karena GPS kurang akurat tidak langsung membunyikan alarm.",
    ...COUNT,
  },
  {
    id: "debounce.escalate",
    label: "Naik dari Dekat batas ke Di luar zona setelah",
    unit: "laporan berturut-turut di luar zona",
    help: "Berlaku untuk peringatan Dekat batas zona yang sedang terbuka.",
    ...COUNT,
  },
  {
    id: "debounce.resolve",
    label: "Peringatan selesai setelah",
    unit: "laporan berturut-turut di dalam zona",
    help: "Mencegah peringatan terus berganti saat gelang di tepi zona.",
    ...COUNT,
  },
];

const ALL_FIELDS = [...INTERVAL_FIELDS, SIGNAL_FIELD, ...ALARM_FIELDS];

export type FormValues = Record<FieldId, string>;

/** The saved numbers as the text the inputs show. */
export function toForm(settings: Settings): FormValues {
  return {
    "interval.normal": String(settings.intervals.normal),
    "interval.warn": String(settings.intervals.warn),
    "interval.alert": String(settings.intervals.alert),
    "interval.unassigned": String(settings.intervals.unassigned),
    signalLost: String(settings.signalLostMultiplier),
    "debounce.open": String(settings.debounce.open),
    "debounce.escalate": String(settings.debounce.escalate),
    "debounce.resolve": String(settings.debounce.resolve),
  };
}

/** The whole number in a text, or null if it isn't one ("", "3.5", "abc", "1e2"). */
export function parseWhole(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

/** What is wrong with one field's text, in words, or null if it is fine. */
export function fieldError(spec: FieldSpec, text: string): string | null {
  const value = parseWhole(text);
  if (value === null) return "Isi dengan bilangan bulat.";
  if (value < spec.min || value > spec.max) return `Antara ${spec.min} dan ${spec.max}.`;
  return null;
}

export function formErrors(values: FormValues): Partial<Record<FieldId, string>> {
  const errors: Partial<Record<FieldId, string>> = {};
  for (const spec of ALL_FIELDS) {
    const error = fieldError(spec, values[spec.id]);
    if (error) errors[spec.id] = error;
  }
  return errors;
}

export interface Change {
  spec: FieldSpec;
  from: number;
  to: number;
}

/** The fields whose value differs from what is saved. Fields that don't parse are skipped. */
export function changesOf(saved: Settings, values: FormValues): Change[] {
  const before = toForm(saved);
  const changes: Change[] = [];
  for (const spec of ALL_FIELDS) {
    const to = parseWhole(values[spec.id]);
    const from = Number(before[spec.id]);
    if (to !== null && to !== from) changes.push({ spec, from, to });
  }
  return changes;
}

/** The smallest PUT /settings body for these changes, so the audit log shows only what moved. */
export function toPatch(changes: Change[]): SettingsPatch {
  const patch: SettingsPatch = {};
  for (const { spec, to } of changes) {
    if (spec.id === "signalLost") patch.signalLostMultiplier = to;
    else if (spec.id.startsWith("interval.")) {
      patch.intervals = { ...patch.intervals, [spec.id.slice("interval.".length)]: to };
    } else {
      patch.debounce = { ...patch.debounce, [spec.id.slice("debounce.".length)]: to };
    }
  }
  return patch;
}

/**
 * How long a bracelet may stay silent before Sinyal hilang opens, if it reports at the normal
 * rate. Other states report faster, so it opens sooner there. Null while a field isn't valid.
 */
export function silenceSeconds(values: FormValues): number | null {
  const interval = parseWhole(values["interval.normal"]);
  const missed = parseWhole(values.signalLost);
  return interval === null || missed === null ? null : interval * missed;
}
