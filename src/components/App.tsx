"use client";

import { useSyncExternalStore } from "react";
import { getApiKey, getServerApiKey, subscribeApiKey } from "@/lib/session";
import Dashboard from "./Dashboard";
import LoginForm from "./LoginForm";

/** Shows the login form or the dashboard, depending on whether a key is stored. */
export default function App() {
  const apiKey = useSyncExternalStore(subscribeApiKey, getApiKey, getServerApiKey);

  // undefined: prerendered on the server, the browser hasn't checked storage yet.
  if (apiKey === undefined) return <div className="flex-1 bg-ground" />;
  if (apiKey === null) return <LoginForm />;
  // key={apiKey}: a different key starts a fresh dashboard (new socket, empty state).
  return <Dashboard key={apiKey} apiKey={apiKey} />;
}
