import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configuré." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, value: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`));
      };
      const channel = supabase
        .channel(`commercial-negotiations-${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "negotiations" }, (payload) => send("negotiation", { table: "negotiations", event: payload.eventType }))
        .on("postgres_changes", { event: "*", schema: "public", table: "negotiation_steps" }, (payload) => send("negotiation", { table: "negotiation_steps", event: payload.eventType }))
        .on("postgres_changes", { event: "*", schema: "public", table: "negotiation_exchanges" }, (payload) => send("negotiation", { table: "negotiation_exchanges", event: payload.eventType }))
        .subscribe((status) => {
          if (status === "SUBSCRIBED") send("ready", { connected: true });
        });
      const heartbeat = setInterval(() => send("heartbeat", { at: Date.now() }), 20_000);
      cleanup = () => {
        clearInterval(heartbeat);
        void supabase.removeChannel(channel);
        try { controller.close(); } catch { /* connection already closed */ }
      };
      request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
