import { commercialRealtimeStream } from "@/lib/commercial-realtime-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export function GET(request: Request) {
  // Reordering creates an activity transactionally; the private order table need not be published.
  return commercialRealtimeStream(request, [
    "leads", "tasks", "activities", "estimations", "appointments", "offers", "negotiations",
  ]);
}
