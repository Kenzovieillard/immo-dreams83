import "server-only";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

/** Invalidation only: rows and identifiers never cross this service-role stream. */
export async function commercialRealtimeStream(request: Request, tables: readonly string[], changeEvent = "change") {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configuré." }, { status: 503 });
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let connected = false;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const encoder = new TextEncoder();
      const channel = supabase.channel(`commercial-sync-${crypto.randomUUID()}`);
      cleanup = () => {
        if (closed) return;
        closed = true;
        timers.forEach(clearTimeout);
        request.signal.removeEventListener("abort", cleanup);
        void supabase.removeChannel(channel).catch(() => {});
        try { controller.close(); } catch { /* The HTTP consumer already cancelled. */ }
      };
      const send = (event: string, value: unknown) => {
        if (closed) return;
        if ((controller.desiredSize ?? 0) < -32) { cleanup(); return; }
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`)); }
        catch { cleanup(); }
      };
      channel.on("system", {}, (payload: { extension?: string; status?: string }) => {
        if (payload.extension !== "postgres_changes") return;
        connected = payload.status === "ok";
        send(connected ? "ready" : "degraded", { connected });
      });
      for (const table of tables) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, () => send(changeEvent, { at: Date.now() }));
      }
      request.signal.addEventListener("abort", cleanup, { once: true });
      if (request.signal.aborted) { cleanup(); return; }
      channel.subscribe((status) => {
        // SUBSCRIBED confirms only the channel handshake, not PostgreSQL readiness.
        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          send("degraded", { connected: false });
          cleanup();
        }
      });
      timers.push(setTimeout(() => { if (!connected) send("degraded", { connected: false }); }, 10_000));
      const heartbeat = () => {
        if (closed) return;
        send("heartbeat", { at: Date.now(), connected });
        timers.push(setTimeout(heartbeat, 10_000));
      };
      timers.push(setTimeout(heartbeat, 10_000));
      // Reauthorize each renewal and stay below the serverless execution limit.
      timers.push(setTimeout(() => { send("reconnect", { at: Date.now() }); cleanup(); }, 45_000));
      send("connecting", { connected: false });
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "private, no-store, no-cache, no-transform",
    "X-Accel-Buffering": "no",
  } });
}
