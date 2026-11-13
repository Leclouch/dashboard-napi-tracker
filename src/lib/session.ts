import { Api, ApiError } from "./api";
import type { Me } from "./types";

// Who is logged in. The login itself is an httpOnly cookie that page code can't read (so a bug in
// a page can't leak it), which means the only way to find out is to ask the backend: GET /auth/me.
//
// Exposed as a tiny store for React's useSyncExternalStore: the server (prerender) always sees
// "checking", the browser sees the answer once the backend replies.

export type SessionState =
  | { status: "checking" }
  /** The backend didn't answer. Not the same as logged out: the cookie may be fine. */
  | { status: "unreachable" }
  /** ended: the session stopped by itself, so the login screen must say the alarm is off. */
  | { status: "out"; ended: boolean }
  | { status: "in"; me: Me };

const CHECKING: SessionState = { status: "checking" };
const RETRY_MS = 5000;

const api = new Api();
const listeners = new Set<() => void>();
let state: SessionState = CHECKING;
let started = false;
/** A deliberate logout: the socket drop that follows must not read as "your session ended". */
let leaving = false;

function setState(next: SessionState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  if (!started) {
    started = true;
    void checkSession();
  }
  return () => listeners.delete(listener);
}

export function getSession(): SessionState {
  return state;
}

export function getServerSession(): SessionState {
  return CHECKING;
}

/** Asks the backend who is logged in. A server hiccup never logs anyone out. */
export async function checkSession(): Promise<void> {
  try {
    setState({ status: "in", me: await api.me() });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      if (state.status === "in") sessionEnded();
      else setState({ status: "out", ended: false });
      return;
    }
    if (state.status === "in") return;
    setState({ status: "unreachable" });
    setTimeout(() => void checkSession(), RETRY_MS);
  }
}

/** The backend refused the session: it expired, was disabled, or was logged out elsewhere. */
export function sessionEnded(): void {
  if (state.status === "out") return;
  setState({ status: "out", ended: !leaving });
}

async function leave(request: () => Promise<void>): Promise<void> {
  leaving = true;
  try {
    await request();
  } catch (error) {
    // Already logged out is fine. Anything else: the cookie is still there, and page code can't
    // remove it, so staying on the page and saying so is the honest result.
    if (!(error instanceof ApiError && error.status === 401)) {
      leaving = false;
      throw error;
    }
  }
  setState({ status: "out", ended: false });
  leaving = false;
}

export function logOut(): Promise<void> {
  return leave(() => api.logout());
}

export function logOutEverywhere(): Promise<void> {
  return leave(() => api.logoutEverywhere());
}
