"use client";

import { useEffect, useState } from "react";
import { useShell } from "@/lib/live-context";
import { logOut, logOutEverywhere } from "@/lib/session";

const ROW_BUTTON = "min-h-11 w-full rounded-full px-4 text-base font-semibold disabled:opacity-60";

/** Shows who is logged in, so a handover can't go unnoticed, and the ways to leave. */
export default function AccountMenu({ onClose }: { onClose: () => void }) {
  const { me } = useShell();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      // On success App swaps to the login screen, which removes this menu.
      await action();
    } catch {
      setError("Gagal keluar, Anda masih masuk. Periksa koneksi lalu coba lagi.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-ink/40 p-4">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Akun"
        className="relative w-full max-w-xs space-y-3 rounded-2xl bg-white p-4"
      >
        <div>
          <p className="text-lg font-extrabold text-ink">{me.displayName}</p>
          <p className="truncate text-sm text-ink-soft">{me.email}</p>
          <p className="text-sm text-ink-soft">
            {me.role === "superadmin" ? "Superadmin" : "Staf"}
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-alert-tint px-3 py-2 text-sm text-[#7f1212]">
            {error}
          </p>
        )}
        {confirming ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">
              Semua perangkat Anda akan keluar dan perangkat yang diingat dilupakan.
            </p>
            <button
              type="button"
              onClick={() => run(logOutEverywhere)}
              disabled={busy}
              className={`${ROW_BUTTON} bg-[#b91c1c] text-white hover:bg-[#8f1414]`}
            >
              {busy ? "Memproses…" : "Ya, keluar dari semua"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className={`${ROW_BUTTON} text-ink hover:bg-ground`}
            >
              Batal
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => run(logOut)}
              disabled={busy}
              className={`${ROW_BUTTON} bg-brand text-white hover:bg-brand-dark`}
            >
              {busy ? "Memproses…" : "Keluar"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={busy}
              className={`${ROW_BUTTON} border border-line text-ink hover:bg-ground`}
            >
              Keluar dari semua perangkat
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
