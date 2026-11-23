"use client";

import { useEffect, useState } from "react";
import type { Api } from "./api";
import type { ReplayRequest } from "./replay";
import type { ReplayPath } from "./types";

export type ReplayLoad =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "ready"; path: ReplayPath };

function keyOf(request: ReplayRequest): string {
  return `${request.braceletId}|${request.from}|${request.to}`;
}

/** Fetches the path a replay asks for. Null while nothing is being replayed. */
export function useReplayPath(api: Api, request: ReplayRequest | null): ReplayLoad | null {
  const [result, setResult] = useState<{ key: string; load: ReplayLoad } | null>(null);
  const key = request ? keyOf(request) : null;

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    const requestKey = keyOf(request);
    api.fixRange(request.braceletId, request.from, request.to).then(
      (path) => {
        if (!cancelled) setResult({ key: requestKey, load: { state: "ready", path } });
      },
      () => {
        if (!cancelled) setResult({ key: requestKey, load: { state: "failed" } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [api, request]);

  if (key === null) return null;
  return result?.key === key ? result.load : { state: "loading" };
}
