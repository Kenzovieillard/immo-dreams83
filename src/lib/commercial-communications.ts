import "server-only";

type ReminderInput = {
  channel: "EMAIL" | "SMS";
  recipient: string;
  recipientName: string;
  subject: string;
  message: string;
  negotiationId: string;
};

export type ReminderResult =
  | { sent: true; provider: "webhook"; providerMessageId: string | null }
  | { sent: false; reason: "provider_not_configured" | "provider_error"; detail?: string };

export async function sendCommercialClientReminder(input: ReminderInput): Promise<ReminderResult> {
  const endpoint = process.env.CRM_TRANSACTIONAL_COMMUNICATION_WEBHOOK_URL;
  const token = process.env.CRM_TRANSACTIONAL_COMMUNICATION_WEBHOOK_TOKEN;
  if (!endpoint || !token) return { sent: false, reason: "provider_not_configured" };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!response.ok) return { sent: false, reason: "provider_error", detail: `HTTP ${response.status}` };
    const payload = await response.json().catch(() => null) as { messageId?: string } | null;
    return { sent: true, provider: "webhook", providerMessageId: payload?.messageId ?? null };
  } catch (error) {
    return { sent: false, reason: "provider_error", detail: error instanceof Error ? error.message : "Erreur réseau" };
  }
}

