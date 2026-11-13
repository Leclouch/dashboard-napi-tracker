"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { formatDateTime, formatDuration } from "@/lib/format";
import { useShell } from "@/lib/live-context";
import {
  ALARM_FIELDS,
  INTERVAL_FIELDS,
  SIGNAL_FIELD,
  changesOf,
  formErrors,
  silenceSeconds,
  toForm,
  toPatch,
  type FieldId,
  type FieldSpec,
  type FormValues,
} from "@/lib/settings";
import type { Settings } from "@/lib/types";

const SMALL_BUTTON =
  "min-h-10 rounded-full border border-line px-3 text-sm font-semibold text-ink hover:bg-ground disabled:opacity-60";

function Field({
  spec,
  value,
  error,
  editable,
  onChange,
}: {
  spec: FieldSpec;
  value: string;
  error: string | undefined;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  const helpId = `${spec.id}-help`;
  return (
    <div>
      <label className="block text-sm font-semibold text-ink" htmlFor={spec.id}>
        {spec.label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={spec.id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!editable}
          inputMode="numeric"
          aria-invalid={error !== undefined}
          aria-describedby={helpId}
          className={`h-12 w-24 rounded-xl border bg-white px-3 text-center text-base tabular-nums text-ink disabled:bg-ground ${
            error ? "border-[#b91c1c]" : "border-line"
          }`}
        />
        <span className="text-sm text-ink-soft">{spec.unit}</span>
      </div>
      <p id={helpId} className={`mt-1 text-sm ${error ? "font-semibold text-[#b91c1c]" : "text-ink-soft"}`}>
        {error ?? spec.help}
      </p>
    </div>
  );
}

/**
 * How often bracelets report and when alarms open. Everyone can read it; only a superadmin can
 * change it, and the backend enforces that. Saving asks first, because these numbers decide how
 * fast an alarm sounds.
 */
export default function SettingsSheet() {
  const { live, me } = useShell();
  const { api } = live;
  const editable = me.role === "superadmin";

  const [saved, setSaved] = useState<Settings | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.settings().then(
      (settings) => {
        if (cancelled) return;
        setSaved(settings);
        setValues(toForm(settings));
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [api]);

  const errors = values ? formErrors(values) : {};
  const changes = saved && values ? changesOf(saved, values) : [];
  const canSave = editable && changes.length > 0 && Object.keys(errors).length === 0 && !busy;
  const silence = values ? silenceSeconds(values) : null;

  function edit(id: FieldId, value: string) {
    setValues((current) => (current ? { ...current, [id]: value } : current));
    // The list in the confirmation would no longer match what is typed.
    setConfirming(false);
    setDone(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateSettings(toPatch(changes));
      setSaved(updated);
      setValues(toForm(updated));
      setConfirming(false);
      setDone(
        "Pengaturan disimpan. Hitungan peringatan berlaku sekarang; setiap gelang memakai interval baru pada laporan berikutnya.",
      );
    } catch (err) {
      setConfirming(false);
      if (err instanceof ApiError && err.status === 403) {
        setError("Hanya superadmin yang bisa mengubah pengaturan.");
      } else if (err instanceof ApiError && err.status === 400) {
        setError("Server menolak nilai ini. Periksa batas tiap isian.");
      } else {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      }
    } finally {
      setBusy(false);
    }
  }

  const field = (spec: FieldSpec) =>
    values && (
      <Field
        key={spec.id}
        spec={spec}
        value={values[spec.id]}
        error={errors[spec.id]}
        editable={editable && !busy}
        onChange={(value) => edit(spec.id, value)}
      />
    );

  return (
    <main className="float-surface fixed inset-x-0 top-36 bottom-16 z-[1050] overflow-y-auto rounded-t-3xl lg:inset-auto lg:top-20 lg:bottom-3 lg:left-3 lg:w-[min(46rem,calc(100vw-23rem-2.25rem))] lg:rounded-2xl">
      <div className="p-4 lg:p-6">
        <h2 className="text-2xl font-extrabold text-ink">Pengaturan</h2>
        {saved && (
          <p className="mt-1 text-sm text-ink-soft">Terakhir diubah {formatDateTime(saved.updatedAt)}.</p>
        )}

        <div aria-live="polite">
          {error && <p className="mt-3 rounded-xl bg-alert-tint px-4 py-2 text-sm text-[#7f1212]">{error}</p>}
          {done && <p className="mt-3 rounded-xl bg-[#e3f4e8] px-4 py-2 text-sm text-[#115c2d]">{done}</p>}
          {loadFailed && (
            <p className="mt-3 rounded-xl bg-alert-tint px-4 py-2 text-sm text-[#7f1212]">
              Pengaturan gagal dimuat. Muat ulang halaman ini.
            </p>
          )}
          {!editable && (
            <p className="mt-3 rounded-xl bg-ground px-4 py-2 text-sm text-ink">
              Hanya superadmin yang bisa mengubah pengaturan. Anda bisa melihatnya di sini.
            </p>
          )}
        </div>

        {!values && !loadFailed && <p className="mt-4 text-sm text-ink-soft">Memuat…</p>}

        {values && (
          <>
            <section className="mt-6">
              <h3 className="text-base font-bold text-ink">Seberapa sering gelang melapor</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Jarak antar laporan posisi. Makin kecil angkanya, makin sering melapor dan makin boros
                baterai.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">{INTERVAL_FIELDS.map(field)}</div>
            </section>

            <section className="mt-6">
              <h3 className="text-base font-bold text-ink">Sinyal hilang</h3>
              <div className="mt-3 max-w-sm">{field(SIGNAL_FIELD)}</div>
              {silence !== null && (
                <p className="mt-2 text-sm text-ink-soft">
                  Pada laporan normal, itu sekitar {formatDuration(silence * 1000)} tanpa kabar. Pada kondisi
                  lain gelang melapor lebih cepat, jadi peringatan muncul lebih cepat.
                </p>
              )}
            </section>

            <section className="mt-6">
              <h3 className="text-base font-bold text-ink">Kapan peringatan dibuka dan selesai</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">{ALARM_FIELDS.map(field)}</div>
            </section>

            {editable && (
              <section className="mt-6">
                {confirming ? (
                  <div className="rounded-xl bg-warn-tint px-4 py-3 text-sm text-[#7a3a04]">
                    <p className="font-semibold">
                      Ini memengaruhi seberapa cepat peringatan muncul. Simpan perubahan berikut?
                    </p>
                    <ul className="mt-2 space-y-1">
                      {changes.map(({ spec, from, to }) => (
                        <li key={spec.id}>
                          {spec.label}: {from} menjadi <span className="font-bold">{to}</span> {spec.unit}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => setConfirming(false)} className={SMALL_BUTTON}>
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void save()}
                        className="min-h-10 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                      >
                        {busy ? "Menyimpan…" : "Ya, simpan"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!canSave}
                      onClick={() => setConfirming(true)}
                      className="min-h-12 rounded-full bg-brand px-6 font-bold text-white hover:bg-brand-dark disabled:opacity-50"
                    >
                      Simpan perubahan
                    </button>
                    {changes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setValues(saved ? toForm(saved) : values);
                          setDone(null);
                        }}
                        className={SMALL_BUTTON}
                      >
                        Batalkan perubahan
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
