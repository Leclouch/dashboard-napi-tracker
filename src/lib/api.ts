import type {
  Assignment,
  AuditEntry,
  Bracelet,
  Episode,
  Fix,
  LinkDelivery,
  LoginStep,
  Me,
  NewAccount,
  NewAssignment,
  Person,
  PersonKind,
  Settings,
  SettingsPatch,
  StaffAccount,
  StaffRole,
  Trail,
  Zone,
} from "./types";

/**
 * Backend base URL. NEXT_PUBLIC_ variables are baked in at build time (see .env.example).
 * The backend must list this dashboard's address in its CORS_ORIGINS.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Set on 429: how long a login is locked. */
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

/**
 * Thin wrapper around fetch. credentials: "include" sends the login cookie; the cookie is
 * httpOnly, so nothing in this app can read it, and the browser does all the work.
 */
export class Api {
  private async request<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        method,
        headers: body === undefined ? {} : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        credentials: "include",
      });
    } catch {
      // fetch only throws when the server can't be reached at all (or CORS blocks it).
      throw new ApiError(0, "Server tidak dapat dihubungi");
    }
    if (!response.ok) {
      const details = (await response.json().catch(() => null)) as { retryAfterSeconds?: number } | null;
      throw new ApiError(
        response.status,
        `Permintaan gagal (HTTP ${response.status})`,
        details?.retryAfterSeconds,
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  me(): Promise<Me> {
    return this.request("GET", "/auth/me");
  }

  login(email: string, password: string): Promise<LoginStep> {
    return this.request("POST", "/auth/login", { email, password });
  }

  verifyCode(challenge: string, code: string, rememberDevice: boolean): Promise<LoginStep> {
    return this.request("POST", "/auth/verify-code", { challenge, code, rememberDevice });
  }

  resendCode(challenge: string): Promise<void> {
    return this.request("POST", "/auth/resend-code", { challenge });
  }

  logout(): Promise<void> {
    return this.request("POST", "/auth/logout");
  }

  logoutEverywhere(): Promise<void> {
    return this.request("POST", "/auth/logout-everywhere");
  }

  forgotPassword(email: string): Promise<void> {
    return this.request("POST", "/auth/forgot-password", { email });
  }

  resetPassword(token: string, password: string): Promise<void> {
    return this.request("POST", "/auth/reset-password", { token, password });
  }

  inviteInfo(token: string): Promise<{ email: string; displayName: string }> {
    return this.request("POST", "/auth/invite/info", { token });
  }

  acceptInvite(token: string, password: string): Promise<void> {
    return this.request("POST", "/auth/invite/accept", { token, password });
  }

  accounts(): Promise<StaffAccount[]> {
    return this.request("GET", "/accounts");
  }

  inviteAccount(input: NewAccount): Promise<{ account: StaffAccount } & LinkDelivery> {
    return this.request("POST", "/accounts", input);
  }

  changeAccount(
    id: number,
    change: { displayName: string; role: StaffRole; guardId: number | null },
  ): Promise<StaffAccount> {
    return this.request("PUT", `/accounts/${id}`, change);
  }

  resendInvite(id: number): Promise<LinkDelivery> {
    return this.request("POST", `/accounts/${id}/resend-invite`);
  }

  disableAccount(id: number): Promise<StaffAccount> {
    return this.request("POST", `/accounts/${id}/disable`);
  }

  enableAccount(id: number): Promise<StaffAccount> {
    return this.request("POST", `/accounts/${id}/enable`);
  }

  sendResetLink(id: number): Promise<LinkDelivery> {
    return this.request("POST", `/accounts/${id}/reset-link`);
  }

  createBackupCode(id: number): Promise<{ code: string; expiresInMinutes: number }> {
    return this.request("POST", `/accounts/${id}/backup-code`);
  }

  auditLog(): Promise<AuditEntry[]> {
    return this.request("GET", "/audit");
  }

  zones(): Promise<Zone[]> {
    return this.request("GET", "/zones");
  }

  settings(): Promise<Settings> {
    return this.request("GET", "/settings");
  }

  /** Superadmin only (403 for staff). Send just the fields that change. */
  updateSettings(patch: SettingsPatch): Promise<Settings> {
    return this.request("PUT", "/settings", patch);
  }

  latestFixes(): Promise<Fix[]> {
    return this.request("GET", "/fixes/latest");
  }

  /** Every bracelet's path over the last N minutes (1..1440), oldest point first. */
  trails(minutes: number): Promise<Trail[]> {
    return this.request("GET", `/fixes/trails?minutes=${minutes}`);
  }

  openAlerts(): Promise<Episode[]> {
    return this.request("GET", "/alerts?open=true");
  }

  openAssignments(): Promise<Assignment[]> {
    return this.request("GET", "/assignments?open=true");
  }

  /** Alerts that opened between two WIB days (YYYY-MM-DD, both included); newest 200. */
  alertHistory(from: string, to: string): Promise<Episode[]> {
    return this.request("GET", `/alerts?from=${from}&to=${to}`);
  }

  /** Assignments that were running at some point between two WIB days; newest 200. */
  assignmentHistory(from: string, to: string): Promise<Assignment[]> {
    return this.request("GET", `/assignments?from=${from}&to=${to}`);
  }

  acknowledge(alertId: number): Promise<Episode> {
    return this.request("POST", `/alerts/${alertId}/acknowledge`);
  }

  bracelets(): Promise<Bracelet[]> {
    return this.request("GET", "/bracelets");
  }

  inmates(): Promise<Person[]> {
    return this.request("GET", "/inmates");
  }

  guards(): Promise<Person[]> {
    return this.request("GET", "/guards");
  }

  addPerson(kind: PersonKind, name: string): Promise<Person> {
    return this.request("POST", `/${kind}`, { name });
  }

  renamePerson(kind: PersonKind, id: number, name: string): Promise<Person> {
    return this.request("PUT", `/${kind}/${id}`, { name });
  }

  /** 409 while the person still has an open assignment. */
  deactivatePerson(kind: PersonKind, id: number): Promise<Person> {
    return this.request("POST", `/${kind}/${id}/deactivate`);
  }

  reactivatePerson(kind: PersonKind, id: number): Promise<Person> {
    return this.request("POST", `/${kind}/${id}/reactivate`);
  }

  startAssignment(input: NewAssignment): Promise<Assignment> {
    return this.request("POST", "/assignments", input);
  }

  endAssignment(assignmentId: number): Promise<Assignment> {
    return this.request("POST", `/assignments/${assignmentId}/end`);
  }
}
