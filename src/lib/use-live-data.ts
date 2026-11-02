"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Api, API_URL, ApiError } from "./api";
import type { Assignment, Episode, Fix, ServerToClientEvents, Zone } from "./types";

export type Connection = "connecting" | "online" | "offline";

export interface LiveData {
  zones: Zone[];
  /** Newest fix per bracelet, keyed by braceletId. */
  fixes: Record<number, Fix>;
  openAlerts: Episode[];
  openAssignments: Assignment[];
  connection: Connection;
  /** True once the first REST snapshot arrived; before that, empty lists mean nothing. */
  loaded: boolean;
  /** Last load error shown to the user, or null. */
  error: string | null;
}

const EMPTY: LiveData = {
  zones: [],
  fixes: {},
  openAlerts: [],
  openAssignments: [],
  connection: "connecting",
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
export function useLiveData(apiKey: string, onUnauthorized: () => void) {
  const api = useMemo(() => new Api(apiKey), [apiKey]);
  const [data, setData] = useState<LiveData>(EMPTY);

  // Kept in a ref so a new callback from the parent doesn't reconnect the socket.
  const onUnauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const fail = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      onUnauthorizedRef.current();
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
    const socket: Socket<ServerToClientEvents> = io(`${API_URL}/live`, {
      auth: { apiKey },
    });

    socket.on("connect", () => {
      setData((d) => ({ ...d, connection: "online" }));
      void reloadAll();
    });
    socket.on("disconnect", () => setData((d) => ({ ...d, connection: "offline" })));
    socket.on("connect_error", (error) => {
      if (error.message === "unauthorized") {
        socket.disconnect();
        onUnauthorizedRef.current();
        return;
      }
      // Socket.IO keeps retrying on its own.
      setData((d) => ({ ...d, connection: "offline" }));
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
      socket.disconnect();
    };
  }, [apiKey, reloadAll, reloadAlerts, reloadAssignments]);

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
