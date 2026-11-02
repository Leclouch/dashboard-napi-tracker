"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Episode } from "./types";

const MUTED_KEY = "gelang.alarmMuted";
/** How often an unacknowledged urgent alert sounds again. */
const REPEAT_MS = 15000;

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, String(muted));
  } catch {
    // Forgotten on reload, which only means the alarm is back on.
  }
}

/** Generated with Web Audio, so there is no sound file to ship. */
function beep(ctx: AudioContext, pulses: number): void {
  const start = ctx.currentTime;
  for (let i = 0; i < pulses; i++) {
    const at = start + i * 0.32;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.15, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.24);
  }
}

/**
 * Sounds when an alert opens or escalates. Alert and signal_lost repeat until acknowledged; warn
 * sounds once. Browsers block audio until someone interacts with the page, so `blocked` tells the
 * header to ask for a click: a silent alarm must never look like a working one.
 */
export function useAlarm(alerts: Episode[]) {
  const [muted, setMuted] = useState(readMuted);
  const [running, setRunning] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const heardRef = useRef(new Set<string>());
  const mutedRef = useRef(muted);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const ctx = new AudioContext();
    contextRef.current = ctx;
    const syncState = () => setRunning(ctx.state === "running");
    // A pending resume() rejects if the context closes first (logout, React's dev double mount).
    const unlock = () => void ctx.resume().catch(() => undefined);
    ctx.addEventListener("statechange", syncState);
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    unlock();
    return () => {
      ctx.removeEventListener("statechange", syncState);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      contextRef.current = null;
      void ctx.close();
    };
  }, []);

  const play = useCallback((pulses: number) => {
    const ctx = contextRef.current;
    if (ctx && ctx.state === "running" && !mutedRef.current) beep(ctx, pulses);
  }, []);

  const pending = alerts.filter((a) => a.acknowledgedAt === null);
  // The key includes the type, so warn -> alert counts as new and sounds again.
  const pendingKeys = pending.map((a) => `${a.id}:${a.type}`).join(",");
  const hasUrgent = pending.some((a) => a.type !== "warn");

  useEffect(() => {
    const keys = pendingKeys === "" ? [] : pendingKeys.split(",");
    const fresh = keys.filter((key) => !heardRef.current.has(key));
    heardRef.current = new Set(keys);
    if (fresh.length === 0) return;
    play(fresh.some((key) => !key.endsWith(":warn")) ? 3 : 1);
  }, [pendingKeys, play]);

  useEffect(() => {
    if (!hasUrgent) return;
    const timer = setInterval(() => play(3), REPEAT_MS);
    return () => clearInterval(timer);
  }, [hasUrgent, play]);

  const toggle = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    writeMuted(next);
    void contextRef.current?.resume().catch(() => undefined);
    // Turning it on gives one beep, so the user knows the speakers work.
    if (!next) window.setTimeout(() => play(1), 100);
  }, [play]);

  return { muted, blocked: !running, toggle };
}
