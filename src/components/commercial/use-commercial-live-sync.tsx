"use client";

import { useEffect, useRef, useState } from "react";
import { createCommercialSyncQueue } from "@/lib/commercial-sync-queue";
import { CommercialBadge } from "./commercial-ui";

type Transport = "connecting" | "live" | "polling" | "offline";

export function useCommercialLiveSync({ enabled = true, endpoint, paused, refresh, cancel }: {
  enabled?: boolean;
  endpoint: string;
  paused: boolean;
  refresh: () => Promise<unknown>;
  cancel: () => Promise<unknown>;
}) {
  const [transport, setTransport] = useState<Transport>("connecting");
  const [failed, setFailed] = useState(false);
  const callbacks = useRef({ refresh, cancel });
  const queueRef = useRef<ReturnType<typeof createCommercialSyncQueue> | null>(null);
  const pausedRef = useRef(paused);
  useEffect(() => { callbacks.current = { refresh, cancel }; }, [refresh, cancel]);
  useEffect(() => {
    pausedRef.current = paused;
    queueRef.current?.setPaused(paused || !navigator.onLine || document.visibilityState === "hidden");
    if (paused) void callbacks.current.cancel();
    else queueRef.current?.request();
  }, [paused]);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let lastMessage = Date.now();
    const queue = createCommercialSyncQueue({
      refresh: () => callbacks.current.refresh(),
      onError: () => { if (!pausedRef.current) setFailed(true); },
      onSuccess: () => setFailed(false),
    });
    queueRef.current = queue;
    const available = () => navigator.onLine && document.visibilityState !== "hidden";
    const close = () => { source?.close(); source = null; clearTimeout(retry); retry = undefined; };
    const reconnect = (immediate = false) => {
      close();
      if (disposed || !available()) return;
      setTransport("polling");
      const delay = immediate ? 0 : Math.min(30_000, 1_000 * 2 ** Math.min(attempts++, 5)) + Math.random() * 500;
      retry = setTimeout(connect, delay);
    };
    const connect = () => {
      if (disposed || !available()) return;
      close();
      setTransport("connecting");
      lastMessage = Date.now();
      source = new EventSource(endpoint);
      const current = source;
      const isCurrent = () => !disposed && current === source;
      const received = () => { lastMessage = Date.now(); };
      const ready = () => { if (!isCurrent()) return; received(); attempts = 0; setTransport("live"); queue.request(); };
      current.addEventListener("connecting", () => { if (isCurrent()) received(); });
      current.addEventListener("ready", ready);
      for (const event of ["change", "negotiation"]) {
        current.addEventListener(event, () => { if (!isCurrent()) return; received(); queue.request(); });
      }
      current.addEventListener("heartbeat", (event) => {
        if (!isCurrent()) return;
        received();
        try {
          const heartbeat = JSON.parse((event as MessageEvent).data);
          setTransport(heartbeat.connected === true ? "live" : "polling");
        } catch { reconnect(); }
      });
      current.addEventListener("degraded", () => { if (!isCurrent()) return; received(); setTransport("polling"); });
      current.addEventListener("reconnect", () => { if (isCurrent()) reconnect(true); });
      current.onerror = () => { if (isCurrent()) reconnect(); };
    };
    const resume = () => {
      close();
      queue.setPaused(pausedRef.current || !available());
      if (!navigator.onLine) { setTransport("offline"); return; }
      if (available()) { queue.request(); connect(); }
      else setTransport("polling");
    };
    window.addEventListener("online", resume);
    window.addEventListener("offline", resume);
    document.addEventListener("visibilitychange", resume);
    // A healthy stream can still miss an event: reconcile against the canonical API.
    const poll = setInterval(() => { if (available()) queue.request(); }, 15_000);
    const watchdog = setInterval(() => {
      if (source && available() && Date.now() - lastMessage > 30_000) reconnect();
    }, 5_000);
    resume();
    return () => {
      disposed = true; close(); queue.dispose(); queueRef.current = null;
      clearInterval(poll); clearInterval(watchdog);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [enabled, endpoint]);
  return { transport, failed, paused, enabled };
}

export function CommercialSyncStatus({ state }: { state: ReturnType<typeof useCommercialLiveSync> }) {
  if (!state.enabled) return null;
  const label = state.transport === "offline" ? "Hors ligne — reprise automatique"
    : state.failed ? "Actualisation en échec — nouvelle tentative automatique"
    : state.paused ? "Actualisation différée pendant votre saisie"
    : state.transport === "live" ? "Temps réel connecté"
    : state.transport === "connecting" ? "Connexion en cours"
    : "Synchronisation de secours · 15 s";
  return <span role="status" data-testid="commercial-sync-status" className="min-w-0 max-w-full"><CommercialBadge className="max-w-full whitespace-normal" tone={state.transport === "live" && !state.failed && !state.paused ? "success" : "neutral"}>{label}</CommercialBadge></span>;
}
