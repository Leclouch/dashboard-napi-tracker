"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { AUDIT_LABEL, formatDateTime, auditTargetText } from "@/lib/format";
import { useShell } from "@/lib/live-context";
import type {
  AccountStatus,
  AuditEntry,
  LinkDelivery,
  Person,
  StaffAccount,
  StaffRole,
} from "@/lib/types";
import PageSheet from "./PageSheet";

const INPUT =
  "mt-1 block h-12 w-full rounded-xl border border-line bg-white px-3 text-base font-normal text-ink";
const SMALL_BUTTON =
  "min-h-10 squircle border border-line px-3 text-sm font-semibold text-ink hover:bg-ground disabled:opacity-60";

const STATUS_LABEL: Record<AccountStatus, string> = {
  invited: "Menunggu undangan diterima",
  active: "Aktif",
  disabled: "Dinonaktifkan",
};

const ROLE_LABEL: Record<StaffRole, string> = { superadmin: "Superadmin", staff: "Staf" };

/** Something a superadmin must copy by hand, because it is shown once. */
type Handover = { title: string; value: string };

function conflictText(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 409) return fallback;
  return error instanceof Error ? error.message : "Terjadi kesalahan";
}

function delivery(result: LinkDelivery, name: string): Handover | string {
  if (result.sent) return `Email terkirim ke ${name}.`;
  return {
    title: `Email gagal terkirim. Berikan tautan ini langsung ke ${name}:`,
    value: result.link ?? "",
  };
}

function GuardSelect({
  guards,
  value,
  onChange,
}: {
  guards: Person[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-ink">
      Data petugas (boleh kosong)
      <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT}>
        <option value="">Bukan petugas lapangan</option>
        {guards.map((guard) => (
          <option key={guard.id} value={guard.id}>
            {guard.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function RoleSelect({ value, onChange }: { value: StaffRole; onChange: (value: StaffRole) => void }) {
  return (
    <label className="block text-sm font-semibold text-ink">
      Peran
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as StaffRole)}
        className={INPUT}
      >
        <option value="staff">Staf</option>
        <option value="superadmin">Superadmin</option>
      </select>
    </label>
  );
}

function AccountRow({
  account,
  isMe,
  guards,
  onChanged,
}: {
  account: StaffAccount;
  isMe: boolean;
  guards: Person[];
  onChanged: (message: string | Handover | null, failed?: string) => void;
}) {
  const { live } = useShell();
  const { api } = live;
  const [mode, setMode] = useState<"idle" | "edit" | "disable">("idle");
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState(account.displayName);
  const [role, setRole] = useState(account.role);
  const [guardId, setGuardId] = useState(account.guardId === null ? "" : String(account.guardId));

  async function run(action: () => Promise<string | Handover>, conflict: string) {
    setBusy(true);
    try {
      onChanged(await action());
      setMode("idle");
    } catch (error) {
      onChanged(null, conflictText(error, conflict));
    } finally {
      setBusy(false);
    }
  }

  const name = account.displayName;

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="font-bold text-ink">
          {name}
          {isMe && " (Anda)"}
        </span>
        <span className="text-sm text-ink-soft">{ROLE_LABEL[account.role]}</span>
      </div>
      <p className="truncate text-sm text-ink-soft">{account.email}</p>
      {account.guardName && <p className="text-sm text-ink-soft">Petugas: {account.guardName}</p>}
      <p className={`text-sm ${account.status === "disabled" ? "font-semibold text-[#b91c1c]" : "text-ink-soft"}`}>
        {STATUS_LABEL[account.status]}
      </p>

      {mode === "edit" && (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(async () => {
              await api.changeAccount(account.id, {
                displayName: displayName.trim(),
                role,
                guardId: guardId === "" ? null : Number(guardId),
              });
              return `Akun ${displayName.trim()} diperbarui.`;
            }, "Harus tersisa satu superadmin yang aktif.");
          }}
        >
          <label className="block text-sm font-semibold text-ink">
            Nama
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={INPUT}
            />
          </label>
          <RoleSelect value={role} onChange={setRole} />
          <GuardSelect guards={guards} value={guardId} onChange={setGuardId} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !displayName.trim()} className={SMALL_BUTTON}>
              Simpan
            </button>
            <button type="button" onClick={() => setMode("idle")} className={SMALL_BUTTON}>
              Batal
            </button>
          </div>
        </form>
      )}

      {mode === "disable" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="mr-auto text-sm font-semibold text-ink">
            {name} langsung keluar dari semua perangkat.
          </span>
          <button type="button" onClick={() => setMode("idle")} className={SMALL_BUTTON}>
            Batal
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api.disableAccount(account.id);
                return `Akun ${name} dinonaktifkan.`;
              }, "Harus tersisa satu superadmin yang aktif.")
            }
            className="min-h-10 squircle bg-[#b91c1c] px-4 text-sm font-semibold text-white hover:bg-[#8f1414] disabled:opacity-60"
          >
            Ya, nonaktifkan
          </button>
        </div>
      )}

      {mode === "idle" && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode("edit")} className={SMALL_BUTTON}>
            Ubah
          </button>
          {account.status === "invited" && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => delivery(await api.resendInvite(account.id), name), "Undangan sudah diterima.")
              }
              className={SMALL_BUTTON}
            >
              Kirim ulang undangan
            </button>
          )}
          {account.status === "active" && !isMe && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => delivery(await api.sendResetLink(account.id), name), "Akun ini tidak aktif.")
              }
              className={SMALL_BUTTON}
            >
              Kirim tautan sandi
            </button>
          )}
          {account.status === "active" && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { code, expiresInMinutes } = await api.createBackupCode(account.id);
                  return {
                    title: `Kode cadangan ${name}, berlaku ${expiresInMinutes} menit dan sekali pakai. Tetap perlu kata sandi:`,
                    value: code,
                  };
                }, "Akun ini tidak aktif.")
              }
              className={SMALL_BUTTON}
            >
              Buat kode cadangan
            </button>
          )}
          {account.status === "disabled" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api.enableAccount(account.id);
                  return `Akun ${name} diaktifkan kembali.`;
                }, "Akun gagal diaktifkan.")
              }
              className={SMALL_BUTTON}
            >
              Aktifkan
            </button>
          ) : (
            !isMe && (
              <button type="button" onClick={() => setMode("disable")} className={SMALL_BUTTON}>
                Nonaktifkan
              </button>
            )
          )}
        </div>
      )}
    </li>
  );
}

function AuditList({ entries, accounts }: { entries: AuditEntry[]; accounts: StaffAccount[] }) {
  function targetText(entry: AuditEntry): string | null {
    const { target } = entry;
    const id = target?.startsWith("account:") ? Number(target.slice("account:".length)) : null;
    if (id === null) return auditTargetText(target, entry.detail);
    return accounts.find((account) => account.id === id)?.displayName ?? target;
  }

  if (entries.length === 0) return <p className="mt-2 text-sm text-ink-soft">Belum ada catatan.</p>;
  return (
    <ul className="mt-2 divide-y divide-line">
      {entries.map((entry) => {
        const target = targetText(entry);
        return (
          <li key={entry.id} className="py-2">
            <p className="text-sm font-semibold text-ink">
              {AUDIT_LABEL[entry.action] ?? entry.action}
              {target && `: ${target}`}
            </p>
            <p className="text-sm break-all text-ink-soft">
              {formatDateTime(entry.at)}, {entry.actorLabel}
              {entry.ip && `, ${entry.ip}`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** Superadmin page: invite, change and disable accounts, and read the audit log. */
export default function AccountsSheet() {
  const { live, me } = useShell();
  const { api } = live;
  const superadmin = me.role === "superadmin";

  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [guards, setGuards] = useState<Person[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [tab, setTab] = useState<"accounts" | "audit">("accounts");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [guardId, setGuardId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [handover, setHandover] = useState<Handover | null>(null);

  const load = useCallback(
    () => Promise.all([api.accounts(), api.guards(), api.auditLog()]),
    [api],
  );
  const apply = useCallback(
    ([loadedAccounts, loadedGuards, loadedAudit]: Awaited<ReturnType<typeof load>>) => {
      setAccounts(loadedAccounts);
      setGuards(loadedGuards);
      setAudit(loadedAudit);
    },
    [],
  );

  useEffect(() => {
    if (!superadmin) return;
    let cancelled = false;
    load().then(
      (loaded) => {
        if (!cancelled) apply(loaded);
      },
      () => {
        if (!cancelled) setError("Daftar akun gagal dimuat. Muat ulang halaman ini.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load, apply, superadmin]);

  function show(message: string | Handover | null, failed?: string) {
    setError(failed ?? null);
    setDone(typeof message === "string" ? message : null);
    setHandover(message !== null && typeof message === "object" ? message : null);
    if (!failed) {
      load().then(apply, () => setError("Daftar akun gagal dimuat. Muat ulang halaman ini."));
    }
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.inviteAccount({
        email: email.trim(),
        displayName: displayName.trim(),
        role,
        guardId: guardId === "" ? null : Number(guardId),
      });
      show(delivery(result, result.account.displayName));
      setEmail("");
      setDisplayName("");
      setRole("staff");
      setGuardId("");
    } catch (err) {
      show(null, conflictText(err, "Email ini sudah punya akun."));
    } finally {
      setBusy(false);
    }
  }

  const activeSuperadmins = accounts.filter(
    (account) => account.role === "superadmin" && account.status === "active",
  ).length;

  return (
    <PageSheet>
      <div className="p-4 lg:p-6">
        <h2 className="text-2xl font-extrabold text-ink">Akun</h2>

        {!superadmin ? (
          <p className="mt-3 text-base text-ink-soft">Halaman ini hanya untuk superadmin.</p>
        ) : (
          <>
            <div aria-live="polite">
              {error && <p className="mt-3 rounded-xl bg-alert-tint px-4 py-2 text-sm text-[#7f1212]">{error}</p>}
              {done && <p className="mt-3 rounded-xl bg-[#e3f4e8] px-4 py-2 text-sm text-[#115c2d]">{done}</p>}
              {handover && (
                <div className="mt-3 rounded-xl bg-warn-tint px-4 py-2 text-sm text-[#7a3a04]">
                  <p className="font-semibold">{handover.title}</p>
                  <p className="mt-1 select-all break-all font-mono text-base text-ink">{handover.value}</p>
                  <p className="mt-1">Hanya ditampilkan sekali.</p>
                </div>
              )}
              {accounts.length > 0 && activeSuperadmins < 2 && (
                <p className="mt-3 rounded-xl bg-warn-tint px-4 py-2 text-sm text-[#7a3a04]">
                  Baru ada {activeSuperadmins} superadmin aktif. Tambahkan satu lagi, supaya akun tetap
                  bisa dikelola jika yang ini terkunci.
                </p>
              )}
            </div>

            <div role="tablist" className="mt-4 flex gap-1">
              {(
                [
                  ["accounts", "Daftar akun"],
                  ["audit", "Catatan aktivitas"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`min-h-10 squircle px-4 text-sm font-semibold ${
                    tab === value ? "bg-brand text-white" : "text-ink hover:bg-ground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "accounts" ? (
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                <form onSubmit={invite} className="space-y-3">
                  <h3 className="text-base font-bold text-ink">Undang akun baru</h3>
                  <label className="block text-sm font-semibold text-ink">
                    Nama
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className={INPUT}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-ink">
                    Email
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={INPUT}
                    />
                  </label>
                  <RoleSelect value={role} onChange={setRole} />
                  <GuardSelect guards={guards} value={guardId} onChange={setGuardId} />
                  <p className="text-sm text-ink-soft">
                    Pastikan dulu orang ini benar staf, secara langsung atau lewat telepon.
                  </p>
                  <button
                    type="submit"
                    disabled={busy || !email.trim() || !displayName.trim()}
                    className="min-h-12 w-full squircle bg-brand px-4 font-bold text-white hover:bg-brand-dark disabled:opacity-50"
                  >
                    {busy ? "Mengirim…" : "Kirim undangan"}
                  </button>
                </form>

                <section>
                  <h3 className="text-base font-bold text-ink">Akun ({accounts.length})</h3>
                  <ul className="mt-2 space-y-2">
                    {accounts.map((account) => (
                      <AccountRow
                        key={account.id}
                        account={account}
                        isMe={account.id === me.id}
                        guards={guards}
                        onChanged={show}
                      />
                    ))}
                  </ul>
                </section>
              </div>
            ) : (
              <section className="mt-4">
                <h3 className="text-base font-bold text-ink">200 aktivitas terakhir</h3>
                <AuditList entries={audit} accounts={accounts} />
              </section>
            )}
          </>
        )}
      </div>
    </PageSheet>
  );
}
