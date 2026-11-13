"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { useShell } from "@/lib/live-context";
import type { Assignment, Person, PersonKind } from "@/lib/types";

const INPUT =
  "mt-1 block h-12 w-full rounded-xl border border-line bg-white px-3 text-base font-normal text-ink";
const SMALL_BUTTON =
  "min-h-10 rounded-full border border-line px-3 text-sm font-semibold text-ink hover:bg-ground disabled:opacity-60";

const TABS: { kind: PersonKind; label: string; singular: string }[] = [
  { kind: "inmates", label: "Warga binaan", singular: "warga binaan" },
  { kind: "guards", label: "Petugas", singular: "petugas" },
];

/** Single spaces, no padding: "  Budi   Santoso " and "Budi Santoso" are the same name. */
function normalise(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function sameName(a: string, b: string): boolean {
  return normalise(a).toLowerCase() === normalise(b).toLowerCase();
}

/** The open assignments a person is part of: as the one wearing the bracelet, or the guard. */
function dutiesOf(kind: PersonKind, person: Person, assignments: Assignment[]): Assignment[] {
  return assignments.filter((a) => (kind === "inmates" ? a.inmateId : a.guardId) === person.id);
}

function dutyText(kind: PersonKind, duties: Assignment[]): string {
  const labels = duties.map((a) => a.deviceLabel).join(", ");
  return kind === "inmates" ? `Sedang bertugas, gelang ${labels}` : `Mengawasi ${duties.length} gelang: ${labels}`;
}

function errorText(error: unknown, conflict?: string): string {
  if (conflict && error instanceof ApiError && error.status === 409) return conflict;
  return error instanceof Error ? error.message : "Terjadi kesalahan";
}

type Report = (message: string | null, failed?: string) => void;

function PersonRow({
  kind,
  person,
  duties,
  onChanged,
}: {
  kind: PersonKind;
  person: Person;
  duties: Assignment[];
  onChanged: Report;
}) {
  const { live } = useShell();
  const { api } = live;
  const [mode, setMode] = useState<"idle" | "rename" | "deactivate">("idle");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(person.name);

  async function run(action: () => Promise<string>, conflict?: string) {
    setBusy(true);
    try {
      onChanged(await action());
      setMode("idle");
    } catch (error) {
      onChanged(null, errorText(error, conflict));
    } finally {
      setBusy(false);
    }
  }

  const inactive = person.status === "inactive";
  const onDuty = duties.length > 0;

  return (
    <li className="rounded-xl border border-line p-3">
      <p className={`font-bold ${inactive ? "text-ink-soft" : "text-ink"}`}>{person.name}</p>
      <p className={`text-sm ${onDuty ? "font-semibold text-ink" : "text-ink-soft"}`}>
        {inactive ? "Nonaktif" : onDuty ? dutyText(kind, duties) : "Aktif"}
      </p>

      {mode === "rename" && (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(async () => {
              const saved = await api.renamePerson(kind, person.id, normalise(name));
              // Names inside open assignments come from the server, so fetch them again.
              live.reloadAssignments();
              return `Nama diubah menjadi ${saved.name}.`;
            });
          }}
        >
          <label className="block text-sm font-semibold text-ink">
            Nama
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              className={INPUT}
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !normalise(name)} className={SMALL_BUTTON}>
              Simpan
            </button>
            <button
              type="button"
              onClick={() => {
                setName(person.name);
                setMode("idle");
              }}
              className={SMALL_BUTTON}
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {mode === "deactivate" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="mr-auto text-sm font-semibold text-ink">
            {person.name} tidak bisa dipilih lagi untuk penugasan baru. Riwayat tetap tersimpan.
          </span>
          <button type="button" onClick={() => setMode("idle")} className={SMALL_BUTTON}>
            Batal
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                async () => {
                  await api.deactivatePerson(kind, person.id);
                  return `${person.name} dinonaktifkan.`;
                },
                `${person.name} masih punya penugasan terbuka. Akhiri penugasan itu dulu.`,
              )
            }
            className="min-h-10 rounded-full bg-[#b91c1c] px-4 text-sm font-semibold text-white hover:bg-[#8f1414] disabled:opacity-60"
          >
            Ya, nonaktifkan
          </button>
        </div>
      )}

      {mode === "idle" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setMode("rename")} className={SMALL_BUTTON}>
            Ubah nama
          </button>
          {inactive ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api.reactivatePerson(kind, person.id);
                  return `${person.name} diaktifkan kembali.`;
                })
              }
              className={SMALL_BUTTON}
            >
              Aktifkan kembali
            </button>
          ) : onDuty ? (
            <span className="text-sm text-ink-soft">
              Akhiri dulu di{" "}
              <Link href="/penugasan" className="font-semibold underline">
                Penugasan
              </Link>{" "}
              untuk menonaktifkan.
            </span>
          ) : (
            <button type="button" onClick={() => setMode("deactivate")} className={SMALL_BUTTON}>
              Nonaktifkan
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** Warga binaan and petugas: add, fix a name, take out of use. Open to every staff member. */
export default function DataMasterSheet() {
  const { live } = useShell();
  const { api, openAssignments } = live;

  const [kind, setKind] = useState<PersonKind>("inmates");
  const [lists, setLists] = useState<Record<PersonKind, Person[]>>({ inmates: [], guards: [] });
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState("");
  const [duplicate, setDuplicate] = useState<Person | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(() => Promise.all([api.inmates(), api.guards()]), [api]);

  useEffect(() => {
    let cancelled = false;
    load().then(
      ([inmates, guards]) => {
        if (cancelled) return;
        setLists({ inmates, guards });
        setLoaded(true);
      },
      () => {
        if (!cancelled) setError("Data gagal dimuat. Muat ulang halaman ini.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load]);

  const show: Report = (message, failed) => {
    setError(failed ?? null);
    setDone(message);
    if (!failed) {
      load().then(
        ([inmates, guards]) => setLists({ inmates, guards }),
        () => setError("Data gagal dimuat. Muat ulang halaman ini."),
      );
    }
  };

  const tab = TABS.find((t) => t.kind === kind)!;
  const people = lists[kind];
  const query = search.trim().toLowerCase();
  const visible = people.filter(
    (p) => (showInactive || p.status === "active") && p.name.toLowerCase().includes(query),
  );
  const inactiveCount = people.filter((p) => p.status === "inactive").length;

  async function add(confirmed: boolean) {
    const name = normalise(newName);
    if (!name) return;
    if (!confirmed) {
      // Two people can share a name, so this only asks; it never refuses.
      const same = people.find((p) => sameName(p.name, name));
      if (same) {
        setDuplicate(same);
        return;
      }
    }
    setBusy(true);
    try {
      await api.addPerson(kind, name);
      setNewName("");
      setDuplicate(null);
      show(`${name} ditambahkan.`);
    } catch (err) {
      show(null, errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="float-surface fixed inset-x-0 top-36 bottom-16 z-[1050] overflow-y-auto rounded-t-3xl lg:inset-auto lg:top-20 lg:bottom-3 lg:left-3 lg:w-[min(46rem,calc(100vw-23rem-2.25rem))] lg:rounded-2xl">
      <div className="p-4 lg:p-6">
        <h2 className="text-2xl font-extrabold text-ink">Data master</h2>

        <div aria-live="polite">
          {error && <p className="mt-3 rounded-xl bg-alert-tint px-4 py-2 text-sm text-[#7f1212]">{error}</p>}
          {done && <p className="mt-3 rounded-xl bg-[#e3f4e8] px-4 py-2 text-sm text-[#115c2d]">{done}</p>}
        </div>

        <div role="tablist" className="mt-4 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.kind}
              type="button"
              role="tab"
              aria-selected={kind === t.kind}
              onClick={() => {
                setKind(t.kind);
                setDuplicate(null);
                setSearch("");
              }}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold ${
                kind === t.kind ? "bg-brand text-white" : "text-ink hover:bg-ground"
              }`}
            >
              {t.label} ({lists[t.kind].filter((p) => p.status === "active").length})
            </button>
          ))}
        </div>

        <form
          className="mt-4 space-y-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void add(false);
          }}
        >
          <label className="block text-sm font-semibold text-ink">
            Tambah {tab.singular}
            <input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setDuplicate(null);
              }}
              maxLength={200}
              placeholder="Nama lengkap"
              className={INPUT}
            />
          </label>

          {duplicate ? (
            <div className="rounded-xl bg-warn-tint px-4 py-3 text-sm text-[#7a3a04]">
              <p className="font-semibold">
                Nama ini sudah ada di daftar{duplicate.status === "inactive" ? " (nonaktif)" : ""}:{" "}
                {duplicate.name}.
              </p>
              <p className="mt-1">
                {duplicate.status === "inactive"
                  ? "Jika orangnya sama, gunakan Aktifkan kembali di daftar. "
                  : "Jika orangnya sama, jangan ditambahkan lagi. "}
                Tambahkan hanya jika ini orang yang berbeda dengan nama yang sama.
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setDuplicate(null)} className={SMALL_BUTTON}>
                  Batal
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void add(true)}
                  className="min-h-10 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                >
                  Tetap tambahkan
                </button>
              </div>
            </div>
          ) : (
            <button
              type="submit"
              disabled={busy || !normalise(newName)}
              className="min-h-12 w-full rounded-full bg-brand px-4 font-bold text-white hover:bg-brand-dark disabled:opacity-50 md:w-auto"
            >
              {busy ? "Menyimpan…" : "Tambah"}
            </button>
          )}
        </form>

        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <h3 className="text-base font-bold text-ink">
              Daftar {tab.singular} ({visible.length})
            </h3>
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

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama"
            aria-label={`Cari ${tab.singular}`}
            className={INPUT}
          />

          {!loaded && !error ? (
            <p className="mt-3 text-sm text-ink-soft">Memuat…</p>
          ) : visible.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">
              {query ? "Tidak ada nama yang cocok." : `Belum ada data ${tab.singular}.`}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {visible.map((person) => (
                <PersonRow
                  key={person.id}
                  kind={kind}
                  person={person}
                  duties={dutiesOf(kind, person, openAssignments)}
                  onChanged={show}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
