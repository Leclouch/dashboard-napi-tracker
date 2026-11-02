// The admin key lives in sessionStorage: gone when the tab closes, never sent anywhere but the backend.
// Temporary until real staff accounts exist. Storage can throw (private mode, blocked site data),
// so every access is guarded; at worst the user types the key again after a reload.
//
// Exposed as a tiny store for React's useSyncExternalStore: the server (prerender) sees
// `undefined` ("not known yet"), the browser sees the key or null.

const KEY = "gelang.apiKey";
const listeners = new Set<() => void>();
/** Fallback when sessionStorage is unavailable, so login still works until the next reload. */
let memoryKey: string | null = null;

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeApiKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getApiKey(): string | null {
  try {
    return sessionStorage.getItem(KEY) ?? memoryKey;
  } catch {
    return memoryKey;
  }
}

export function getServerApiKey(): undefined {
  return undefined;
}

export function saveApiKey(value: string): void {
  memoryKey = value;
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    // Kept in memory only.
  }
  notify();
}

export function clearApiKey(): void {
  memoryKey = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
  notify();
}
