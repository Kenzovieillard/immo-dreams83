"use client";

import { useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CommercialPreviewContext } from "./commercial-ui";
import { CommercialSyncStatus, useCommercialLiveSync } from "./use-commercial-live-sync";

/** Only the sync queue initiates background, permission-filtered reads. */
export function useCommercialResourceSync<T>({
  initialData, endpoint, paused = false,
}: { initialData: T; endpoint: string; paused?: boolean }) {
  const preview = useContext(CommercialPreviewContext);
  const client = useQueryClient();
  const queryKey = ["commercial-resource", endpoint];
  const query = useQuery<T>({
    queryKey, initialData, enabled: false, gcTime: 0, retry: false,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(endpoint, { signal, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload.success !== true) {
        throw new Error(response.status === 401
          ? "Session expirée. Reconnectez-vous pour actualiser les données."
          : payload.message ?? "Actualisation impossible.");
      }
      return payload as T;
    },
  });
  const sync = useCommercialLiveSync({
    enabled: !preview,
    // New filter/record, new queue: pending reads cannot cross resource boundaries.
    endpoint: `/api/admin/commercial/realtime?scope=${encodeURIComponent(endpoint)}`,
    paused,
    refresh: () => query.refetch({ throwOnError: true, cancelRefetch: false }),
    cancel: () => client.cancelQueries({ queryKey, exact: true }),
  });
  return {
    data: preview ? initialData : query.data!,
    // A failed read must not make a successful write look as if it failed.
    refresh: () => query.refetch({ cancelRefetch: false }),
    status: <div className="grid min-w-0 gap-2">
      <CommercialSyncStatus state={sync} />
      {!preview && query.error && <p role="alert" className="text-sm text-red-700">
        {query.error.message} Les dernières données chargées restent affichées.
      </p>}
    </div>,
  };
}

export function commercialListEndpoint(
  resource: "estimations" | "visites" | "offres",
  meta: { page: number; limit: number },
  filters = { query: "", status: "ALL" },
) {
  const params = new URLSearchParams({ page: String(meta.page), limit: String(meta.limit) });
  if (filters.query) params.set("q", filters.query);
  if (filters.status !== "ALL") params.set("status", filters.status);
  return `/api/admin/commercial/${resource}?${params}`;
}
