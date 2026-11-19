"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CommercialPanel, fieldClass } from "./commercial-ui";
import { money, shortDate } from "@/lib/commercial-presentation";
import type { CommercialOfferSummary } from "@/types/commercial";
import type { NegotiationsPayload } from "./negotiations-screens";
import { cn } from "@/lib/utils";

export function OfferNegotiationTimeline({
  offers,
}: {
  offers: CommercialOfferSummary[];
}) {
  const [selectedId, setSelectedId] = useState(offers[0]?.id);
  const selected = offers.find((offer) => offer.id === selectedId) ?? offers[0];
  const query = useQuery({
    queryKey: ["commercial-negotiation-timeline", selected?.negotiationId],
    enabled: Boolean(selected?.negotiationId),
    queryFn: async () => {
      const response = await fetch(
        "/api/admin/commercial/negotiations?id=" +
          encodeURIComponent(selected!.negotiationId!),
        { cache: "no-store" },
      );
      const payload = (await response.json()) as NegotiationsPayload;
      if (!response.ok || !payload.success)
        throw new Error(payload.message ?? "Chronologie indisponible.");
      return (
        payload.data.find((item) => item.id === selected!.negotiationId) ?? null
      );
    },
  });
  if (!selected) return null;
  const negotiation = query.data;
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Parcours de négociation</h2>
        <label className="max-w-full">
          <span className="sr-only">Offre à suivre</span>
          <select
            value={selected.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className={cn(fieldClass, "max-w-full sm:max-w-96")}
          >
            {offers.map((offer) => (
              <option key={offer.id} value={offer.id}>
                {offer.buyerName} · {offer.propertyTitle}
              </option>
            ))}
          </select>
        </label>
      </div>
      <CommercialPanel className="p-5">
        <p className="mb-4 text-sm font-semibold">
          {selected.buyerName} & {selected.propertyTitle}
        </p>
        {query.isFetching && (
          <p role="status" className="text-sm text-[#66716c]">
            Chargement des échanges…
          </p>
        )}
        {query.error ? (
          <p role="alert" className="text-sm text-[#943f37]">
            {query.error.message}
          </p>
        ) : (
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {negotiation?.steps.length ? (
              [...negotiation.steps]
                .sort((a, b) => a.stepNumber - b.stepNumber)
                .map((step) => (
                  <li
                    key={step.id}
                    className={cn(
                      "rounded-xl p-4",
                      step.isCurrent ? "bg-[#dce5d7]" : "bg-[#f6f4ef]",
                    )}
                  >
                    <p className="text-[10px] text-[#66716c]">
                      Étape {step.stepNumber} · {step.label}
                    </p>
                    <p className="mt-2 text-base font-bold text-[#2f493a]">
                      {money(step.amount)}
                    </p>
                    <p className="mt-2 text-[10px] text-[#66716c]">
                      {shortDate(step.createdAt)}
                    </p>
                  </li>
                ))
            ) : (
              <li className="rounded-xl bg-[#f6f4ef] p-4">
                <p className="text-xs">Offre enregistrée</p>
                <p className="mt-2 font-bold">{money(selected.amount)}</p>
                <p className="mt-2 text-xs text-[#66716c]">
                  Aucun échange de négociation relié.
                </p>
              </li>
            )}
            {negotiation && (
              <li className="rounded-xl border border-[#dfddd4] p-4">
                <p className="text-xs">Décision finale</p>
                <p className="mt-2 font-semibold">
                  {["ACCEPTED", "CONCLUDED"].includes(negotiation.status)
                    ? "Acceptée"
                    : negotiation.status === "REJECTED"
                      ? "Refusée"
                      : negotiation.status === "EXPIRED"
                        ? "Expirée"
                        : "À l’étude"}
                </p>
                <p className="mt-2 text-[10px] text-[#66716c]">
                  {negotiation.responseDeadline
                    ? "Échéance : " + shortDate(negotiation.responseDeadline)
                    : "Échéance non renseignée"}
                </p>
              </li>
            )}
          </ol>
        )}
      </CommercialPanel>
    </section>
  );
}
