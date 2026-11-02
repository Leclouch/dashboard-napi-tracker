"use client";

import { useState, type FormEvent } from "react";
import { Api, ApiError } from "@/lib/api";
import { saveApiKey } from "@/lib/session";

/** Temporary login: the shared admin key. Real staff accounts come next. */
export default function LoginForm() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = key.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await new Api(value).checkKey();
      saveApiKey(value);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Kunci akses salah."
          : err instanceof Error
            ? err.message
            : "Terjadi kesalahan",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-ink p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded bg-white p-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Gelang GPS</h1>
          <p className="text-base text-ink-soft">Pemantauan warga binaan, Lapas Cebongan</p>
        </div>
        <label className="block text-base font-medium text-ink">
          Kunci akses
          <input
            type="password"
            autoComplete="current-password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="mt-1 block w-full rounded border border-ink-soft px-3 py-2 text-ink"
            autoFocus
          />
        </label>
        {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
        <button
          type="submit"
          disabled={busy || !key.trim()}
          className="min-h-11 w-full rounded bg-ink px-3 font-semibold text-white hover:bg-ink-soft disabled:opacity-50"
        >
          {busy ? "Memeriksa…" : "Masuk"}
        </button>
      </form>
    </main>
  );
}
