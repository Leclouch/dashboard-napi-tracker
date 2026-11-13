"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { Api, ApiError } from "@/lib/api";

const MIN_PASSWORD_LENGTH = 12;

const subscribeNothing = () => () => undefined;
/** The part of the link after #. Browsers never send it to any server. */
const readToken = () => window.location.hash.slice(1);
const noToken = () => null;

/** The page an emailed link opens: an invite (first password) or a reset (new password). */
export default function SetPasswordPage({ mode }: { mode: "invite" | "reset" }) {
  const api = useMemo(() => new Api(), []);
  const token = useSyncExternalStore(subscribeNothing, readToken, noToken);
  const [person, setPerson] = useState<{ email: string; displayName: string } | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [badLink, setBadLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    if (mode !== "invite" || !token) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      api.inviteInfo(token).then(
        (info) => {
          if (cancelled) return;
          setUnreachable(false);
          setPerson(info);
        },
        (err) => {
          if (cancelled) return;
          // Only the backend saying 400 means the link is bad. Anything else (backend down,
          // network gone) says nothing about the link, so keep asking.
          if (err instanceof ApiError && err.status === 400) {
            setBadLink(true);
          } else {
            setUnreachable(true);
            retry = setTimeout(check, 5000);
          }
        },
      );
    };
    check();
    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, [api, mode, token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "invite") await api.acceptInvite(token, password);
      else await api.resetPassword(token, password);
      // The token is spent; keep it out of the history and the address bar.
      window.history.replaceState(null, "", window.location.pathname);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) setBadLink(true);
      else setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  const tooShort = password.length < MIN_PASSWORD_LENGTH;
  const mismatch = repeat !== "" && repeat !== password;
  const linkMissing = token === "" || badLink;

  return (
    <main className="flex flex-1 items-center justify-center bg-brand p-4">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6">
        <h1 className="text-2xl font-extrabold text-brand">Gelang GPS</h1>
        {done ? (
          <>
            <p className="text-base text-ink">Kata sandi tersimpan. Silakan masuk.</p>
            <Link href="/" className="block squircle bg-brand px-3 py-3 text-center font-bold text-white">
              Ke halaman masuk
            </Link>
          </>
        ) : linkMissing ? (
          <p role="alert" className="rounded-xl bg-alert-tint px-4 py-2 text-sm text-[#7f1212]">
            Tautan ini tidak berlaku atau sudah kedaluwarsa. Minta tautan baru ke superadmin.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-base text-ink">
              {mode === "reset"
                ? "Buat kata sandi baru."
                : person
                  ? `Halo ${person.displayName}, buat kata sandi untuk ${person.email}.`
                  : "Memeriksa tautan…"}
            </p>
            {unreachable && (
              <p role="alert" className="rounded-xl bg-alert-tint px-4 py-2 text-sm text-[#7f1212]">
                Server tidak dapat dihubungi. Mencoba lagi…
              </p>
            )}
            <label className="block text-base font-medium text-ink">
              Kata sandi baru
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="mt-1 block h-12 w-full rounded-xl border border-ink-soft px-3 text-ink"
                autoFocus
              />
              <span className="mt-1 block text-sm font-normal text-ink-soft">
                Minimal {MIN_PASSWORD_LENGTH} karakter. Kalimat pendek lebih mudah diingat.
              </span>
            </label>
            <label className="block text-base font-medium text-ink">
              Ulangi kata sandi
              <input
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                autoComplete="new-password"
                className="mt-1 block h-12 w-full rounded-xl border border-ink-soft px-3 text-ink"
              />
            </label>
            {mismatch && <p className="text-sm text-[#b91c1c]">Kata sandi belum sama.</p>}
            {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
            <button
              type="submit"
              disabled={busy || tooShort || repeat !== password}
              className="min-h-12 w-full squircle bg-brand px-3 font-bold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? "Menyimpan…" : "Simpan kata sandi"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
