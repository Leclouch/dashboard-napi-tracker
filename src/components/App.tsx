"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { getApiKey, getServerApiKey, subscribeApiKey } from "@/lib/session";
import AppShell from "./AppShell";
import LoginForm from "./LoginForm";

/** Shows the login form or the app, depending on whether a key is stored. */
export default function App({ children }: { children: ReactNode }) {
  const apiKey = useSyncExternalStore(subscribeApiKey, getApiKey, getServerApiKey);

  // undefined: prerendered on the server, the browser hasn't checked storage yet.
  if (apiKey === undefined) return <div className="flex-1 bg-ground" />;
  if (apiKey === null) return <LoginForm />;
  // key={apiKey}: a different key starts fresh (new socket, empty state).
  return (
    <AppShell key={apiKey} apiKey={apiKey}>
      {children}
    </AppShell>
  );
}
