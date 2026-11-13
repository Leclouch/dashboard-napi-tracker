"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useShell } from "@/lib/live-context";
import type { Assignment, Bracelet, Person } from "@/lib/types";
import PageSheet from "./PageSheet";

function Field({
  label,
  value,
  onChange,
  emptyText,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  emptyText: string;
  options: { value: number; label: string }[];
}) {
  return (
    <label className="block text-sm font-semibold text-ink">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={options.length === 0}
        className="mt-1 block h-12 w-full truncate rounded-xl border border-line bg-white px-3 text-base font-normal text-ink disabled:bg-ground disabled:text-ink-soft"
      >
        <option value="">{options.length === 0 ? emptyText : `Pilih ${label.toLowerCase()}`}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RunningRow({
  assignment,
  onEnd,
}: {
  assignment: Assignment;
  onEnd: (assignment: Assignment) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function end() {
    setBusy(true);
    await onEnd(assignment);
    setBusy(false);
    setConfirming(false);
  }

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold text-ink">{assignment.inmateName}</span>
        <span className="text-sm text-ink-soft">{assignment.deviceLabel}</span>
      </div>
      <p className="text-sm text-ink-soft">
        {assignment.zoneName}, petugas {assignment.guardName}
      </p>
      <p className="text-sm text-ink-soft">
        Mulai {formatDateTime(assignment.startedAt)} oleh{" "}
        {assignment.startedByName ?? "sebelum akun staf"}
      </p>
      {confirming ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="mr-auto text-sm font-semibold text-ink">Pemantauan gelang ini berhenti.</span>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="min-h-10 squircle px-4 text-sm font-semibold text-ink hover:bg-ground"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={end}
            disabled={busy}
            className="min-h-10 squircle bg-[#b91c1c] px-4 text-sm font-semibold text-white hover:bg-[#8f1414] disabled:opacity-60"
          >
            {busy ? "Mengakhiri…" : "Ya, akhiri"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-2 min-h-10 squircle border border-line px-4 text-sm font-semibold text-ink hover:bg-ground"
        >
          Akhiri penugasan
        </button>
      )}
    </li>
  );
}

/** Start and end assignments. Opens as a sheet over the map; AppShell keeps the alerts visible. */
export default function AssignmentsSheet() {
  const { live } = useShell();
  const { api, reloadAssignments, openAssignments, zones } = live;

  const [bracelets, setBracelets] = useState<Bracelet[]>([]);
  const [inmates, setInmates] = useState<Person[]>([]);
  const [guards, setGuards] = useState<Person[]>([]);
  const [braceletId, setBraceletId] = useState("");
  const [inmateId, setInmateId] = useState("");
  const [guardId, setGuardId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.bracelets(), api.inmates(), api.guards()])
      .then(([loadedBracelets, loadedInmates, loadedGuards]) => {
        if (cancelled) return;
        setBracelets(loadedBracelets);
        setInmates(loadedInmates);
        setGuards(loadedGuards);
      })
      .catch(() => {
        if (!cancelled) setError("Daftar gelang dan warga binaan gagal dimuat. Muat ulang halaman ini.");
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  // Availability comes from the live assignments, so the lists follow other staff's changes too.
  const takenBracelets = new Set(openAssignments.map((a) => a.braceletId));
  const takenInmates = new Set(openAssignments.map((a) => a.inmateId));
  const freeBracelets = bracelets.filter((b) => b.status === "active" && !takenBracelets.has(b.id));
  const freeInmates = inmates.filter((i) => i.status === "active" && !takenInmates.has(i.id));
  const activeGuards = guards.filter((g) => g.status === "active");

  // A choice someone else just took counts as empty, so the form can't submit it.
  const chosenBracelet = freeBracelets.find((b) => String(b.id) === braceletId);
  const chosenInmate = freeInmates.find((i) => String(i.id) === inmateId);
  const ready = chosenBracelet && chosenInmate && guardId !== "" && zoneId !== "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!chosenBracelet || !chosenInmate || !guardId || !zoneId) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await api.startAssignment({
        braceletId: chosenBracelet.id,
        inmateId: chosenInmate.id,
        guardId: Number(guardId),
        zoneId: Number(zoneId),
      });
      setDone(`${chosenBracelet.deviceLabel} dipakai ${chosenInmate.name}.`);
      // Guard and zone stay: a work crew is handed out one person after another.
      setBraceletId("");
      setInmateId("");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? "Gelang atau warga binaan ini baru saja ditugaskan. Pilih yang lain."
          : err instanceof Error
            ? err.message
            : "Penugasan gagal dimulai",
      );
    } finally {
      reloadAssignments();
      setBusy(false);
    }
  }

  async function endAssignment(assignment: Assignment) {
    setError(null);
    setDone(null);
    try {
      await api.endAssignment(assignment.id);
      setDone(`Penugasan ${assignment.inmateName} diakhiri.`);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? "Penugasan ini sudah diakhiri."
          : err instanceof Error
            ? err.message
            : "Penugasan gagal diakhiri",
      );
    } finally {
      reloadAssignments();
    }
  }

  return (
    <PageSheet>
      <div className="p-4 lg:p-6">
        <h2 className="text-2xl font-extrabold text-ink">Penugasan</h2>

        <div aria-live="polite">
          {error && <p className="mt-3 rounded-xl bg-alert-tint px-4 py-2 text-sm text-[#7f1212]">{error}</p>}
          {done && <p className="mt-3 rounded-xl bg-[#e3f4e8] px-4 py-2 text-sm text-[#115c2d]">{done}</p>}
        </div>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <form onSubmit={submit} className="space-y-3">
            <h3 className="text-base font-bold text-ink">Mulai penugasan</h3>
            <Field
              label="Gelang"
              value={chosenBracelet ? braceletId : ""}
              onChange={setBraceletId}
              emptyText="Semua gelang sedang dipakai"
              options={freeBracelets.map((b) => ({ value: b.id, label: b.deviceLabel }))}
            />
            <Field
              label="Warga binaan"
              value={chosenInmate ? inmateId : ""}
              onChange={setInmateId}
              emptyText="Semua warga binaan sudah memakai gelang"
              options={freeInmates.map((i) => ({ value: i.id, label: i.name }))}
            />
            <Field
              label="Petugas"
              value={guardId}
              onChange={setGuardId}
              emptyText="Belum ada petugas"
              options={activeGuards.map((g) => ({ value: g.id, label: g.name }))}
            />
            <Field
              label="Zona"
              value={zoneId}
              onChange={setZoneId}
              emptyText="Belum ada zona"
              options={zones.map((z) => ({ value: z.id, label: z.name }))}
            />
            <button
              type="submit"
              disabled={!ready || busy}
              className="min-h-12 w-full squircle bg-brand px-4 font-bold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? "Memulai…" : "Mulai penugasan"}
            </button>
          </form>

          <section>
            <h3 className="text-base font-bold text-ink">Sedang berjalan ({openAssignments.length})</h3>
            {openAssignments.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">
                Belum ada penugasan. Mulai dari formulir di halaman ini.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {openAssignments.map((assignment) => (
                  <RunningRow key={assignment.id} assignment={assignment} onEnd={endAssignment} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </PageSheet>
  );
}
