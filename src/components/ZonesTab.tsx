"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { useShell } from "@/lib/live-context";
import type { Zone, ZoneInput } from "@/lib/types";
import {
  clearCorners,
  draftFromBoundary,
  MIN_CORNERS,
  sameCorners,
  shapeProblem,
  toBoundary,
  undo,
  type ZoneDraft,
} from "@/lib/zone-draft";
import {
  DANGER_BUTTON,
  errorText,
  INPUT,
  PRIMARY_BUTTON,
  SMALL_BUTTON,
  SMALL_PRIMARY_BUTTON,
  type Report,
} from "./data-master-ui";

/** The backend's limit for both distances (zone.validate.ts MAX_DISTANCE_METERS). */
const MAX_METERS = 1000;

function metersText(zone: Pick<Zone, "warnMeters" | "alertMeters">): string {
  return `Toleransi GPS ${zone.warnMeters} m, keluar zona setelah ${zone.alertMeters} m`;
}

/** The form's numbers, or what's wrong with them. Mirrors the backend's checks. */
function readForm(name: string, warn: string, alert: string): { input: Omit<ZoneInput, "boundary"> } | { problem: string } {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return { problem: "Isi nama zona." };
  const warnMeters = Number(warn);
  const alertMeters = Number(alert);
  for (const value of [warnMeters, alertMeters]) {
    if (warn.trim() === "" || alert.trim() === "" || !Number.isFinite(value) || value < 0 || value > MAX_METERS) {
      return { problem: `Jarak harus angka 0 sampai ${MAX_METERS} meter.` };
    }
  }
  if (warnMeters > alertMeters) {
    return { problem: "Toleransi GPS tidak boleh lebih besar dari batas keluar zona." };
  }
  return { input: { name: trimmed, warnMeters, alertMeters } };
}

/** Why a save failed, in words. */
function saveError(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    for (const message of error.serverMessages) {
      const problem = shapeProblem(message);
      if (problem) return problem;
    }
    return "Periksa kembali isian zona.";
  }
  if (error instanceof ApiError && error.status === 404) return "Zona ini sudah tidak ada. Muat ulang halaman.";
  return errorText(error);
}

/**
 * Adding a zone or changing one. The outline is drawn on the shared map (the draft lives in the
 * shell); this form holds the name and the distances.
 */
function ZoneEditor({
  zone,
  draft,
  onReport,
}: {
  /** null for a new zone. */
  zone: Zone | null;
  draft: ZoneDraft;
  onReport: Report;
}) {
  const { live, zoneDraft, phoneSheet } = useShell();
  const { api, reloadZones } = live;
  const [name, setName] = useState(zone?.name ?? "");
  const [warn, setWarn] = useState(String(zone?.warnMeters ?? 0));
  const [alert, setAlert] = useState(String(zone?.alertMeters ?? 15));
  const [confirming, setConfirming] = useState<string[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const count = draft.corners.length;
  const originalCorners = zone ? draftFromBoundary(zone.id, zone.boundary).corners : [];
  const reshaped = !sameCorners(originalCorners, draft.corners);

  /** The fields that differ from the saved zone, and the same in words for the confirmation. */
  function changesFrom(saved: Zone, input: Omit<ZoneInput, "boundary">) {
    const patch: Partial<ZoneInput> = {};
    const words: string[] = [];
    if (input.name !== saved.name) {
      patch.name = input.name;
      words.push(`Nama: ${saved.name} → ${input.name}`);
    }
    if (reshaped) {
      patch.boundary = toBoundary(draft.corners);
      words.push(`Batas: ${originalCorners.length} titik → ${count} titik, bentuk baru`);
    }
    if (input.warnMeters !== saved.warnMeters) {
      patch.warnMeters = input.warnMeters;
      words.push(`Toleransi GPS: ${saved.warnMeters} m → ${input.warnMeters} m`);
    }
    if (input.alertMeters !== saved.alertMeters) {
      patch.alertMeters = input.alertMeters;
      words.push(`Batas keluar zona: ${saved.alertMeters} m → ${input.alertMeters} m`);
    }
    return { patch, words };
  }

  async function save(confirmed: boolean) {
    const form = readForm(name, warn, alert);
    if ("problem" in form) return setProblem(form.problem);
    if (count < MIN_CORNERS) return setProblem(`Gambar batas zona di peta: minimal ${MIN_CORNERS} titik.`);
    setProblem(null);

    let saved: string;
    if (zone) {
      const { patch, words } = changesFrom(zone, form.input);
      if (words.length === 0) return setProblem("Belum ada yang diubah.");
      // Changing a zone moves the line bracelets are checked against, so it always asks first.
      if (!confirmed) return setConfirming(words);
      saved = `Zona ${form.input.name} disimpan.`;
      setBusy(true);
      try {
        await api.updateZone(zone.id, patch);
      } catch (error) {
        setBusy(false);
        setConfirming(null);
        return setProblem(saveError(error));
      }
    } else {
      saved = `Zona ${form.input.name} ditambahkan.`;
      setBusy(true);
      try {
        await api.createZone({ ...form.input, boundary: toBoundary(draft.corners) });
      } catch (error) {
        setBusy(false);
        return setProblem(saveError(error));
      }
    }
    reloadZones();
    zoneDraft.set(null);
    onReport(saved);
  }

  return (
    <form
      className="mt-4 space-y-3 rounded-xl border-2 border-brand p-4"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void save(false);
      }}
    >
      <h3 className="text-base font-bold text-ink">{zone ? `Ubah zona ${zone.name}` : "Zona baru"}</h3>

      <label className="block text-sm font-semibold text-ink">
        Nama zona
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className={INPUT} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Toleransi GPS (meter)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_METERS}
            value={warn}
            onChange={(e) => setWarn(e.target.value)}
            className={INPUT}
          />
          <span className="mt-1 block text-sm font-normal text-ink-soft">
            Sampai sejauh ini di luar garis masih dihitung di dalam zona, karena GPS bisa meleset.
          </span>
        </label>
        <label className="block text-sm font-semibold text-ink">
          Batas keluar zona (meter)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_METERS}
            value={alert}
            onChange={(e) => setAlert(e.target.value)}
            className={INPUT}
          />
          <span className="mt-1 block text-sm font-normal text-ink-soft">
            Lebih jauh dari ini: Di luar zona. Di antara keduanya: Dekat batas zona.
          </span>
        </label>
      </div>

      <div className="rounded-xl bg-ground p-3">
        <p className="text-sm text-ink">
          <span className="font-bold">Batas: {count} titik.</span>{" "}
          <span className="hidden lg:inline">
            Klik peta untuk menambah titik, geser titik untuk memindahkan, klik titik untuk menghapus.
          </span>
          <span className="lg:hidden">Buka peta untuk menggambar.</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => phoneSheet.setClosed(true)} className={`${SMALL_PRIMARY_BUTTON} lg:hidden`}>
            Gambar di peta
          </button>
          <button
            type="button"
            disabled={draft.history.length === 0}
            onClick={() => zoneDraft.set(undo(draft))}
            className={SMALL_BUTTON}
          >
            Urungkan
          </button>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => zoneDraft.set(clearCorners(draft))}
            className={SMALL_BUTTON}
          >
            Gambar ulang dari awal
          </button>
        </div>
      </div>

      {problem && <p className="rounded-xl bg-alert-tint px-4 py-2 text-sm text-[#7f1212]">{problem}</p>}

      {confirming && zone ? (
        <div className="rounded-xl bg-warn-tint px-4 py-3 text-sm text-[#7a3a04]">
          <p className="font-semibold">Simpan perubahan ini?</p>
          <ul className="mt-1 list-disc pl-5">
            {confirming.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-2">
            {zone.openAssignments > 0
              ? `${zone.openAssignments} gelang sedang memakai zona ini. Mulai posisi berikutnya, mereka diperiksa dengan batas yang baru, jadi status dan peringatan bisa langsung berubah.`
              : "Tidak ada gelang yang sedang memakai zona ini."}{" "}
            Posisi yang sudah tercatat tetap dengan status lamanya.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setConfirming(null)} className={SMALL_BUTTON}>
              Batal
            </button>
            <button type="button" disabled={busy} onClick={() => void save(true)} className={SMALL_PRIMARY_BUTTON}>
              {busy ? "Menyimpan…" : "Ya, simpan"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
            {busy ? "Menyimpan…" : zone ? "Simpan perubahan" : "Tambah zona"}
          </button>
          <button type="button" onClick={() => zoneDraft.set(null)} className={SMALL_BUTTON}>
            Batal
          </button>
        </div>
      )}
    </form>
  );
}

function ZoneRow({
  zone,
  canEdit,
  onReport,
}: {
  zone: Zone;
  canEdit: boolean;
  onReport: Report;
}) {
  const { live, zoneDraft } = useShell();
  const { api, reloadZones } = live;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const inactive = zone.status === "inactive";
  const inUse = zone.openAssignments > 0;

  async function run(action: () => Promise<unknown>, message: string, conflict?: string) {
    setBusy(true);
    try {
      await action();
      reloadZones();
      setConfirming(false);
      onReport(message);
    } catch (error) {
      onReport(null, errorText(error, conflict));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-line p-3">
      <p className={`font-bold ${inactive ? "text-ink-soft" : "text-ink"}`}>{zone.name}</p>
      <p className={`text-sm ${inUse ? "font-semibold text-ink" : "text-ink-soft"}`}>
        {inactive ? "Nonaktif" : inUse ? `Dipakai ${zone.openAssignments} gelang` : "Aktif, tidak dipakai"}
      </p>
      <p className="text-sm text-ink-soft">
        {metersText(zone)} · {zone.boundary.coordinates[0].length - 1} titik
      </p>

      {canEdit && confirming && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="mr-auto text-sm font-semibold text-ink">
            {zone.name} tidak bisa dipilih lagi untuk penugasan baru dan tidak tampil di peta. Riwayat tetap tersimpan.
          </span>
          <button type="button" onClick={() => setConfirming(false)} className={SMALL_BUTTON}>
            Batal
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                () => api.deactivateZone(zone.id),
                `Zona ${zone.name} dinonaktifkan.`,
                `Zona ${zone.name} masih dipakai. Akhiri penugasannya dulu.`,
              )
            }
            className={DANGER_BUTTON}
          >
            Ya, nonaktifkan
          </button>
        </div>
      )}

      {canEdit && !confirming && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!inactive && (
            <button
              type="button"
              onClick={() => zoneDraft.set(draftFromBoundary(zone.id, zone.boundary))}
              className={SMALL_BUTTON}
            >
              Ubah
            </button>
          )}
          {inactive ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api.reactivateZone(zone.id), `Zona ${zone.name} diaktifkan kembali.`)}
              className={SMALL_BUTTON}
            >
              Aktifkan kembali
            </button>
          ) : inUse ? (
            <span className="text-sm text-ink-soft">
              Akhiri dulu di{" "}
              <Link href="/penugasan" className="font-semibold underline">
                Penugasan
              </Link>{" "}
              untuk menonaktifkan.
            </span>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={SMALL_BUTTON}>
              Nonaktifkan
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** Zones: everyone can see them; only a superadmin adds, reshapes or retires one. */
export default function ZonesTab({ onReport }: { onReport: Report }) {
  const { live, me, zoneDraft } = useShell();
  const { zones, loaded } = live;
  const canEdit = me.role === "superadmin";
  const [showInactive, setShowInactive] = useState(false);
  const draft = zoneDraft.draft;
  const editingZone = draft?.zoneId == null ? null : (zones.find((z) => z.id === draft.zoneId) ?? null);

  const visible = zones.filter((z) => showInactive || z.status === "active");
  const inactiveCount = zones.filter((z) => z.status === "inactive").length;

  return (
    <>
      {!canEdit && (
        <p className="mt-4 text-sm text-ink-soft">Hanya superadmin yang bisa menambah atau mengubah zona.</p>
      )}

      {/* A draft for a zone that isn't in the list (yet) must not turn into a new zone. */}
      {canEdit && draft && (draft.zoneId === null || editingZone) && (
        <ZoneEditor
          // A fresh form per zone, so one zone's name doesn't carry over into the next.
          key={draft.zoneId ?? "new"}
          zone={editingZone}
          draft={draft}
          onReport={onReport}
        />
      )}
      {canEdit && !draft && (
        <button
          type="button"
          onClick={() => {
            onReport(null);
            zoneDraft.set(draftFromBoundary(null, null));
          }}
          className={`mt-4 ${PRIMARY_BUTTON}`}
        >
          Tambah zona
        </button>
      )}

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <h3 className="text-base font-bold text-ink">Daftar zona ({visible.length})</h3>
          {inactiveCount > 0 && (
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4"
              />
              Tampilkan yang nonaktif ({inactiveCount})
            </label>
          )}
        </div>
        {!loaded ? (
          <p className="mt-3 text-sm text-ink-soft">Memuat…</p>
        ) : visible.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Belum ada zona.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {visible.map((zone) => (
              <ZoneRow
                key={zone.id}
                zone={zone}
                // One editor at a time: the map shows one draft.
                canEdit={canEdit && !draft}
                onReport={onReport}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
