import type { AgendaEntry, AgendaMutation } from "@/lib/agenda";

type ErrorData = {
  message?: string;
  code?: string;
  fields?: Record<string, string>;
  conflict?: { startsAt: string; endsAt: string };
};

export class AgendaRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly data: ErrorData,
  ) {
    super(data.message ?? "L’agenda est indisponible. Réessayez.");
  }
}

export async function agendaRequest<T>(
  params: Record<string, string> = {},
  init?: RequestInit,
): Promise<T> {
  const query = new URLSearchParams(params);
  const response = await fetch(
    `/api/admin/agenda${query.size ? `?${query}` : ""}`,
    { cache: "no-store", ...init },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success)
    throw new AgendaRequestError(response.status, {
      ...data,
      message:
        response.status === 401
          ? "Votre session a expiré. Reconnectez-vous pour continuer."
          : data?.message,
    });
  return data as T;
}

export function mutateAgenda(input: AgendaMutation) {
  return agendaRequest<{ result: Pick<AgendaEntry, "id" | "source"> }>(
    {},
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}
