"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Api, API_URL, ApiError } from "./api";
import { checkSession, sessionEnded } from "./session";
import type { Assignment, Episode, Fix, ServerToClientEvents, Zone } from "./types";

export type Connection = "connecting" | "online" | "offline";

export interface LiveData {
  zones: Zone[];
  /** Newest fix per bracelet, keyed by braceletId. */
  fixes: Record<number, Fix>;
  openAlerts: Episode[];
  openAssignments: Assignment[];
  connection: Connection;
  /** When the connection dropped, or null while online. Being connected renews the login. */
  offlineSince: number | null;
  /** True once the first REST snapshot arrived; before that, empty lists mean nothing. */
  loaded: boolean;
  /** Last load error shown to the user, or null. */
  error: string | null;
}

const RETRY_MS = 5000;

const EMPTY: LiveData = {
  zones: [],
  fixes: {},
  openAlerts: [],
  openAssignments: [],
  connection: "connecting",
  offlineSince: null,
  loaded: false,
  error: null,
};

/** Keeps the newer fix per bracelet, so a REST snapshot never overwrites a fresher pushed fix. */
function withFix(fixes: Record<number, Fix>, fix: Fix): Record<number, Fix> {
  const current = fixes[fix.braceletId];
  if (current && new Date(current.recordedAt) >= new Date(fix.recordedAt)) return fixes;
  return { ...fixes, [fix.braceletId]: fix };
}

/**
 * Loads the current state over REST, then keeps it up to date from the /live push.
 * Pushes are not replayed, so everything is reloaded after every (re)connect.
 */
export function useLiveData() {
  const api = useMemo(() => new Api(), []);
  const [data, setData] = useState<LiveData>(EMPTY);

  const fail = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      sessionEnded();
      return;
    }
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    setData((d) => ({ ...d, error: message }));
  }, []);

  const reloadAlerts = useCallback(() => {
    api
      .openAlerts()
      .then((openAlerts) => setData((d) => ({ ...d, openAlerts, error: null })))
      .catch(fail);
  }, [api, fail]);

  const reloadAssignments = useCallback(() => {
    api
      .openAssignments()
      .then((openAssignments) => setData((d) => ({ ...d, openAssignments, error: null })))
      .catch(fail);
  }, [api, fail]);

  const reloadAll = useCallback(async () => {
    try {
      const [zones, latest, openAlerts, openAssignments] = await Promise.all([
        api.zones(),
        api.latestFixes(),
        api.openAlerts(),
        api.openAssignments(),
      ]);
      setData((d) => ({
        ...d,
        zones,
        fixes: latest.reduce(withFix, d.fixes),
        openAlerts,
        openAssignments,
        loaded: true,
        error: null,
      }));
    } catch (error) {
      fail(error);
    }
  }, [api, fail]);

  useEffect(() => {
    // withCredentials: the browser sends the login cookie with the handshake.
    const socket: Socket<ServerToClientEvents> = io(`${API_URL}/live`, { withCredentials: true });

    let retry: ReturnType<typeof setTimeout> | undefined;
    const retryLater = () => {
      clearTimeout(retry);
      retry = setTimeout(() => socket.connect(), RETRY_MS);
    };
    const wentOffline = () =>
      setData((d) => ({
        ...d,
        connection: "offline",
        offlineSince: d.offlineSince ?? Date.now(),
      }));

    socket.on("connect", () => {
      setData((d) => ({ ...d, connection: "online", offlineSince: null }));
      void reloadAll();
      // Picks up changes made while away, such as a new role.
      void checkSession();
    });
    socket.on("disconnect", (reason) => {
      wentOffline();
      // The server hung up on purpose, so Socket.IO won't reconnect by itself. Ask why: the
      // session may have ended, or it may just be a restart.
      if (reason === "io server disconnect") {
        api.me().then(
          () => socket.connect(),
          (error) => {
            if (error instanceof ApiError && error.status === 401) sessionEnded();
            else retryLater();
          },
        );
      }
    });
    socket.on("connect_error", (error) => {
      if (error.message === "unauthorized") {
        socket.disconnect();
        sessionEnded();
        return;
      }
      wentOffline();
      // Refused by the server ("unavailable"): Socket.IO only retries network errors by itself.
      if (!socket.active) retryLater();
    });

    socket.on("fix", (fix) => setData((d) => ({ ...d, fixes: withFix(d.fixes, fix) })));
    socket.on("episode", reloadAlerts);
    socket.on("alert_acknowledged", (episode) =>
      setData((d) => ({
        ...d,
        openAlerts: d.openAlerts.map((a) => (a.id === episode.id ? { ...a, ...episode } : a)),
      })),
    );
    socket.on("assignment", reloadAssignments);

    return () => {
      clearTimeout(retry);
      socket.disconnect();
    };
  }, [api, reloadAll, reloadAlerts, reloadAssignments]);

  const acknowledge = useCallback(
    async (alertId: number) => {
      try {
        const episode = await api.acknowledge(alertId);
        setData((d) => ({
          ...d,
          openAlerts: d.openAlerts.map((a) => (a.id === episode.id ? { ...a, ...episode } : a)),
          error: null,
        }));
      } catch (error) {
        fail(error);
      }
    },
    [api, fail],
  );

  return { ...data, api, acknowledge, reloadAssignments };
}
