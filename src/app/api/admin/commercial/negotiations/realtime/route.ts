import { commercialRealtimeStream } from "@/lib/commercial-realtime-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export function GET(request: Request) {
  return commercialRealtimeStream(request, [
    "negotiations", "negotiation_steps", "negotiation_exchanges",
  ], "negotiation");
}
