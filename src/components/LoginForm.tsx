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
    <main className="flex flex-1 items-center justify-center bg-brand p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6">
        <div>
          <h1 className="text-2xl font-extrabold text-brand">Gelang GPS</h1>
          <p className="text-base text-ink-soft">Pemantauan warga binaan, Lapas Cebongan</p>
        </div>
        <label className="block text-base font-medium text-ink">
          Kunci akses
          <input
            type="password"
            autoComplete="current-password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="mt-1 block h-12 w-full rounded-xl border border-ink-soft px-3 text-ink"
            autoFocus
          />
        </label>
        {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
        <button
          type="submit"
          disabled={busy || !key.trim()}
          className="min-h-12 w-full rounded-full bg-brand px-3 font-bold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Memeriksa…" : "Masuk"}
        </button>
      </form>
    </main>
  );
}
