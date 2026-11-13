"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Api, ApiError } from "@/lib/api";
import { checkSession } from "@/lib/session";

const RESEND_SECONDS = 60;

const INPUT = "mt-1 block h-12 w-full rounded-xl border border-ink-soft px-3 text-ink";
const SUBMIT =
  "min-h-12 w-full rounded-full bg-brand px-3 font-bold text-white hover:bg-brand-dark disabled:opacity-50";
const TEXT_BUTTON = "text-sm font-semibold text-brand hover:underline disabled:text-ink-soft";

type Step =
  | { name: "password" }
  | { name: "code"; challenge: string; canRemember: boolean }
  | { name: "forgot" }
  | { name: "forgot-sent" };

function messageFor(error: unknown, wrong: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return wrong;
    if (error.status === 429) {
      const minutes = Math.ceil((error.retryAfterSeconds ?? 900) / 60);
      return `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.`;
    }
    if (error.status === 400) return "Periksa kembali isian Anda.";
  }
  return error instanceof Error ? error.message : "Terjadi kesalahan";
}

function Card({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-brand p-4">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6">
        <div>
          <h1 className="text-2xl font-extrabold text-brand">Gelang GPS</h1>
          <p className="text-base text-ink-soft">Pemantauan warga binaan, Lapas Cebongan</p>
        </div>
        {children}
      </div>
    </main>
  );
}

function CodeStep({
  api,
  challenge,
  canRemember,
  onBack,
}: {
  api: Api;
  challenge: string;
  canRemember: boolean;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (waitSeconds === 0) return;
    const timer = setTimeout(() => setWaitSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.verifyCode(challenge, code.trim(), remember);
      await checkSession();
    } catch (err) {
      setError(messageFor(err, "Kode salah atau sudah kedaluwarsa."));
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setWaitSeconds(RESEND_SECONDS);
    try {
      await api.resendCode(challenge);
    } catch (err) {
      setError(messageFor(err, "Kode gagal dikirim ulang."));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-base font-medium text-ink">
        Kode dari email
        {/* Plain text: a backup code from a superadmin has letters. */}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          className={INPUT}
          autoFocus
        />
      </label>
      {canRemember && (
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          Ingat perangkat ini selama 30 hari. Jangan centang di perangkat milik orang lain.
        </label>
      )}
      {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
      <button type="submit" disabled={busy || !code.trim()} className={SUBMIT}>
        {busy ? "Memeriksa…" : "Masuk"}
      </button>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className={TEXT_BUTTON}>
          Kembali
        </button>
        <button type="button" onClick={resend} disabled={waitSeconds > 0} className={TEXT_BUTTON}>
          {waitSeconds > 0 ? `Kirim ulang (${waitSeconds})` : "Kirim ulang"}
        </button>
      </div>
      <p className="text-sm text-ink-soft">
        Email tidak datang? Minta kode cadangan ke superadmin, lalu masukkan di kolom yang sama.
      </p>
    </form>
  );
}

/** Password, then the emailed code. A remembered device skips the code. */
export default function LoginForm({ sessionEnded }: { sessionEnded: boolean }) {
  const api = useMemo(() => new Api(), []);
  const [step, setStep] = useState<Step>({ name: "password" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.login(email.trim(), password);
      setPassword("");
      if (result.next === "code") {
        setStep({ name: "code", challenge: result.challenge, canRemember: result.canRemember });
      } else {
        await checkSession();
      }
    } catch (err) {
      setError(messageFor(err, "Email atau kata sandi salah."));
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.forgotPassword(email.trim());
      setStep({ name: "forgot-sent" });
    } catch (err) {
      setError(messageFor(err, "Terjadi kesalahan"));
    } finally {
      setBusy(false);
    }
  }

  if (step.name === "code") {
    return (
      <Card>
        <p className="text-base text-ink">Kode masuk sudah dikirim ke {email.trim()}.</p>
        <CodeStep
          api={api}
          challenge={step.challenge}
          canRemember={step.canRemember}
          onBack={() => setStep({ name: "password" })}
        />
      </Card>
    );
  }

  if (step.name === "forgot" || step.name === "forgot-sent") {
    return (
      <Card>
        {step.name === "forgot" ? (
          <form onSubmit={submitForgot} className="space-y-4">
            <p className="text-base text-ink">Masukkan email akun Anda untuk menerima tautan.</p>
            <label className="block text-base font-medium text-ink">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className={INPUT}
                autoFocus
              />
            </label>
            {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
            <button type="submit" disabled={busy || !email.trim()} className={SUBMIT}>
              {busy ? "Mengirim…" : "Kirim tautan"}
            </button>
            <p className="text-sm text-ink-soft">
              Akun superadmin tidak menerima tautan. Minta superadmin lain untuk mengaturnya.
            </p>
          </form>
        ) : (
          <p className="text-base text-ink">
            Jika email itu terdaftar, tautan sudah dikirim dan berlaku 30 menit.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep({ name: "password" });
          }}
          className={TEXT_BUTTON}
        >
          Kembali ke halaman masuk
        </button>
      </Card>
    );
  }

  return (
    <Card>
      {sessionEnded && (
        <p role="alert" className="rounded-xl bg-alert-tint px-4 py-2 text-sm text-[#7f1212]">
          Sesi Anda berakhir. Alarm dan pemantauan berhenti sampai Anda masuk lagi.
        </p>
      )}
      <form onSubmit={submitPassword} className="space-y-4">
        <label className="block text-base font-medium text-ink">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            className={INPUT}
            autoFocus
          />
        </label>
        <label className="block text-base font-medium text-ink">
          Kata sandi
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={INPUT}
          />
        </label>
        {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
        <button type="submit" disabled={busy || !email.trim() || !password} className={SUBMIT}>
          {busy ? "Memeriksa…" : "Lanjut"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setStep({ name: "forgot" });
        }}
        className={TEXT_BUTTON}
      >
        Lupa kata sandi?
      </button>
    </Card>
  );
}
