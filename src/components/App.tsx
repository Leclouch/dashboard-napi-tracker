"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { getServerSession, getSession, subscribeSession } from "@/lib/session";
import AppShell from "./AppShell";
import LoginForm from "./LoginForm";

/** Reached from an emailed link by someone who can't log in yet. */
const OPEN_PAGES = ["/undangan", "/atur-sandi"];

/** Shows the login form or the app, depending on whether the backend knows this browser. */
export default function App({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, getSession, getServerSession);
  const pathname = usePathname();

  if (OPEN_PAGES.includes(pathname)) return children;
  if (session.status === "checking") return <div className="flex-1 bg-ground" />;
  if (session.status === "unreachable") {
    return (
      <main className="flex flex-1 items-center justify-center bg-brand p-4">
        <p role="alert" className="max-w-sm rounded-3xl bg-white p-6 text-base font-semibold text-ink">
          Server tidak dapat dihubungi. Mencoba lagi…
        </p>
      </main>
    );
  }
  if (session.status === "out") return <LoginForm sessionEnded={session.ended} />;
  // key: another person logging in starts fresh (new socket, empty state).
  return (
    <AppShell key={session.me.id} me={session.me}>
      {children}
    </AppShell>
  );
}
