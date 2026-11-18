"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { formatAgo } from "@/lib/format";
import { useShell } from "@/lib/live-context";
import type { Bracelet } from "@/lib/types";
import {
  DANGER_BUTTON,
  errorText,
  INPUT,
  PRIMARY_BUTTON,
  SMALL_BUTTON,
  type Report,
} from "./data-master-ui";

/** Same rule as the backend (firmware-config.ts): one MQTT topic level. */
const LABEL = /^[a-z0-9][a-z0-9-]{0,31}$/;

/**
 * The config.h for flashing a bracelet, plus what has to be done by hand. Holds no passwords:
 * the bracelet's broker user is made in EMQX, and its password never passes through here.
 */
function FirmwareConfig({ label, config, onClose }: { label: string; config: string; onClose: () => void }) {
  const [copied, setCopied] = useState<boolean | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(config);
      setCopied(true);
    } catch {
      // No clipboard (an http page or a refused permission): the text can still be selected.
      setCopied(false);
    }
  }

  return (
    <div className="mt-2 space-y-3 rounded-xl bg-ground p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm font-bold text-ink">config.h untuk {label}</p>
        <button type="button" onClick={() => void copy()} className={SMALL_BUTTON}>
          {copied ? "Tersalin" : "Salin"}
        </button>
        <button type="button" onClick={onClose} className={SMALL_BUTTON}>
          Tutup
        </button>
      </div>
      {copied === false && (
        <p className="text-sm text-ink-soft">Tidak bisa menyalin otomatis. Pilih teks di bawah, lalu salin.</p>
      )}
      <pre className="max-h-64 overflow-auto rounded-lg bg-white p-3 text-xs leading-relaxed text-ink select-all">
        {config}
      </pre>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
        <li>
          Di EMQX, buka Access Control → Authentication, tambahkan pengguna dengan nama persis{" "}
          <span className="font-mono font-semibold">{label}</span>, dengan sandi baru.
        </li>
        <li>
          Isi <span className="font-mono">MQTT_USER</span> dan <span className="font-mono">MQTT_PASS</span> di
          config.h. Simpan sandinya di pengelola sandi tim, jangan di repo.
        </li>
        <li>Flash firmware gelang dengan config.h ini.</li>
        <li>
          Nyalakan gelang di luar ruangan dan pastikan posisinya muncul di peta (abu-abu, belum bertugas)
          sebelum diserahkan.
        </li>
      </ol>
    </div>
  );
}

function BraceletRow({
  bracelet,
  wornBy,
  canEdit,
  onChanged,
}: {
  bracelet: Bracelet;
  /** The inmate wearing it now, from the live assignments. */
  wornBy: string | null;
  canEdit: boolean;
  onChanged: Report;
}) {
  const { live, now } = useShell();
  const { api } = live;
  const [mode, setMode] = useState<"idle" | "deactivate">("idle");
  const [config, setConfig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inactive = bracelet.status === "inactive";
  const label = bracelet.deviceLabel;

  async function run(action: () => Promise<unknown>, message: string, conflict?: string) {
    setBusy(true);
    try {
      await action();
      setMode("idle");
      onChanged(message);
    } catch (error) {
      onChanged(null, errorText(error, conflict));
    } finally {
      setBusy(false);
    }
  }

  async function showConfig() {
    setBusy(true);
    try {
      setConfig((await api.braceletFirmwareConfig(bracelet.id)).firmwareConfig);
    } catch (error) {
      onChanged(null, errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-line p-3">
      <p className={`font-bold ${inactive ? "text-ink-soft" : "text-ink"}`}>{label}</p>
      <p className={`text-sm ${wornBy ? "font-semibold text-ink" : "text-ink-soft"}`}>
        {inactive ? "Nonaktif" : wornBy ? `Dipakai ${wornBy}` : "Aktif, siap dipakai"}
      </p>
      <p className="text-sm text-ink-soft">
        {bracelet.lastFixAt ? `Posisi terakhir ${formatAgo(bracelet.lastFixAt, now)}` : "Belum pernah mengirim posisi"}
      </p>

      {config !== null && <FirmwareConfig label={label} config={config} onClose={() => setConfig(null)} />}

      {canEdit && mode === "deactivate" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="mr-auto text-sm font-semibold text-ink">
            {label} tidak bisa dipilih lagi untuk penugasan. Riwayat tetap tersimpan. Agar gelang ini tidak
            bisa terhubung sama sekali, hapus juga pengguna EMQX-nya.
          </span>
          <button type="button" onClick={() => setMode("idle")} className={SMALL_BUTTON}>
            Batal
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                () => api.deactivateBracelet(bracelet.id),
                `${label} dinonaktifkan.`,
                `${label} sedang dipakai. Akhiri penugasannya dulu.`,
              )
            }
            className={DANGER_BUTTON}
          >
            Ya, nonaktifkan
          </button>
        </div>
      )}

      {canEdit && mode === "idle" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {config === null && (
            <button type="button" disabled={busy} onClick={() => void showConfig()} className={SMALL_BUTTON}>
              Lihat config.h
            </button>
          )}
          {inactive ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api.reactivateBracelet(bracelet.id), `${label} diaktifkan kembali.`)}
              className={SMALL_BUTTON}
            >
              Aktifkan kembali
            </button>
          ) : wornBy || bracelet.openAssignmentId !== null ? (
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

/**
 * Bracelets: everyone can see them; a superadmin adds and retires them. There is no rename: the
 * label is the MQTT topic and the EMQX username flashed into the firmware.
 */
export default function BraceletsTab({ onReport }: { onReport: Report }) {
  const { live, me } = useShell();
  const { api, openAssignments } = live;
  const canEdit = me.role === "superadmin";

  const [bracelets, setBracelets] = useState<Bracelet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [added, setAdded] = useState<{ label: string; config: string } | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api.bracelets().then(
        (list) => {
          setBracelets(list);
          setLoaded(true);
          setLoadFailed(false);
        },
        () => setLoadFailed(true),
      ),
    [api],
  );

  useEffect(() => {
    // Loading is a sync with the server; the state updates land when it answers.
    void load();
  }, [load]);

  const report: Report = (message, failed) => {
    onReport(message, failed);
    if (!failed) void load();
  };

  const label = newLabel.trim();
  const labelOk = LABEL.test(label);
  const visible = bracelets.filter((b) => showInactive || b.status === "active");
  const inactiveCount = bracelets.filter((b) => b.status === "inactive").length;

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!labelOk) return;
    setBusy(true);
    try {
      const result = await api.addBracelet(label);
      setNewLabel("");
      setAdded({ label: result.bracelet.deviceLabel, config: result.firmwareConfig });
      report(`${result.bracelet.deviceLabel} ditambahkan. Siapkan firmware-nya dengan langkah di bawah.`);
    } catch (error) {
      onReport(
        null,
        error instanceof ApiError && error.status === 409
          ? `Label ${label} sudah dipakai gelang lain.`
          : errorText(error),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {canEdit ? (
        <form className="mt-4 space-y-2" onSubmit={add}>
          <label className="block text-sm font-semibold text-ink">
            Tambah gelang
            <input
              value={newLabel}
              // Labels are lowercase; typing capitals would only be refused.
              onChange={(e) => setNewLabel(e.target.value.toLowerCase())}
              maxLength={32}
              placeholder="contoh: gelang-03"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`${INPUT} font-mono`}
            />
          </label>
          <p className="text-sm text-ink-soft">
            Huruf kecil, angka dan tanda hubung, maksimal 32. Label tidak bisa diubah nanti, karena tertanam di
            firmware dan menjadi nama pengguna EMQX.
          </p>
          {label !== "" && !labelOk && (
            <p className="text-sm text-[#b91c1c]">Label harus diawali huruf atau angka, tanpa spasi.</p>
          )}
          <button type="submit" disabled={busy || !labelOk} className={PRIMARY_BUTTON}>
            {busy ? "Menyimpan…" : "Tambah"}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-ink-soft">Hanya superadmin yang bisa menambah atau menonaktifkan gelang.</p>
      )}

      {added && <FirmwareConfig label={added.label} config={added.config} onClose={() => setAdded(null)} />}

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <h3 className="text-base font-bold text-ink">Daftar gelang ({visible.length})</h3>
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
        {loadFailed ? (
          <p className="mt-3 rounded-xl bg-alert-tint px-4 py-2 text-sm text-[#7f1212]">
            Daftar gelang gagal dimuat. Muat ulang halaman ini.
          </p>
        ) : !loaded ? (
          <p className="mt-3 text-sm text-ink-soft">Memuat…</p>
        ) : visible.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Belum ada gelang.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {visible.map((bracelet) => (
              <BraceletRow
                key={bracelet.id}
                bracelet={bracelet}
                wornBy={openAssignments.find((a) => a.braceletId === bracelet.id)?.inmateName ?? null}
                canEdit={canEdit}
                onChanged={report}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
