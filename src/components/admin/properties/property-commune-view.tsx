"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Property } from "@/data/properties";
import { BentoEmptyState } from "@/components/admin/bento/bento-states";
import {
  CommercialPanel,
  commercialSecondaryButton,
} from "@/components/commercial/commercial-ui";
import {
  groupPropertiesByCommune,
  isMapPostalCode,
  type PropertyCommuneIndex,
} from "@/lib/property-communes";
import { PropertyMap } from "./property-map";
import styles from "./property-layout.module.css";

type Lookup = {
  index: PropertyCommuneIndex;
  unavailable: string[];
  key: string;
  attempt: number;
};
const emptyIndex: PropertyCommuneIndex = {};

async function readPostalCodes(codes: string[], signal: AbortSignal) {
  const index: PropertyCommuneIndex = {};
  const unavailable: string[] = [];
  for (let i = 0; i < codes.length; i += 24) {
    const batch = codes.slice(i, i + 24);
    if (signal.aborted) break;
    try {
      const url = `/api/admin/properties/communes?${new URLSearchParams({ codes: batch.join(",") })}`;
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error("Recherche des communes indisponible.");
      const result: { index: PropertyCommuneIndex } = await response.json();
      Object.assign(index, result.index);
    } catch {
      if (!signal.aborted) unavailable.push(...batch);
    }
  }
  return { index, unavailable };
}

export function PropertyCommuneView({
  properties,
  postalCodes,
  renderRow,
}: {
  properties: Property[];
  postalCodes: string[];
  renderRow: (property: Property) => ReactNode;
}) {
  const key = postalCodes.join(",");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const index = lookup?.key === key ? lookup.index : emptyIndex;
  const pending = Boolean(
    key && (lookup?.key !== key || lookup.attempt !== attempt),
  );

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    void readPostalCodes(
      key.split(",").filter(isMapPostalCode),
      controller.signal,
    ).then((result) => {
      if (controller.signal.aborted) return;
      setLookup((previous) => ({
        key,
        attempt,
        index: {
          ...(previous?.key === key ? previous.index : {}),
          ...result.index,
        },
        unavailable: result.unavailable,
      }));
    });
    return () => controller.abort();
  }, [key, attempt]);

  const { groups, unlocated } = useMemo(
    () => groupPropertiesByCommune(properties, index),
    [properties, index],
  );
  const locations = useMemo(
    () =>
      groups.map(({ centre, properties }) => ({
        ...centre,
        count: properties.length,
      })),
    [groups],
  );
  const selected = groups.find((group) => group.centre.code === selectedCode);
  const hasFailure =
    !pending && lookup?.key === key && lookup.unavailable.length > 0;
  const locatedCount = properties.length - unlocated.length;

  return (
    <section
      aria-label="Biens par commune"
      className="grid min-w-0 grid-cols-1 gap-3"
    >
      <p className="text-sm text-[#59645f]">
        Position approximative au centre de chaque commune. Les nombres suivent
        les filtres du portefeuille.
      </p>
      {pending ? (
        <p role="status" className="text-sm">
          Recherche des communes…
        </p>
      ) : null}
      {hasFailure ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 text-sm text-[#815c1a]"
        >
          Certaines communes sont temporairement indisponibles.
          <button
            type="button"
            className={commercialSecondaryButton}
            onClick={() => setAttempt((value) => value + 1)}
          >
            Réessayer
          </button>
        </div>
      ) : null}
      <div className={`grid min-w-0 gap-4 ${styles.communeColumns}`}>
        {locations.length ? (
          <PropertyMap
            locations={locations}
            selectedCode={selected?.centre.code ?? null}
            onSelect={setSelectedCode}
          />
        ) : (
          <BentoEmptyState
            title={
              pending ? "Chargement de la carte" : "Aucune commune positionnée"
            }
            description="La liste reste disponible à côté de la carte."
          />
        )}
        <CommercialPanel className="min-w-0 max-h-[26rem] overflow-auto p-3">
          {selected ? (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">
                  {selected.centre.name} ({selected.properties.length})
                </h3>
                <button
                  type="button"
                  className={commercialSecondaryButton}
                  onClick={() => setSelectedCode(null)}
                >
                  Toutes les communes
                </button>
              </div>
              {selected.properties.map(renderRow)}
            </>
          ) : (
            <>
              <h3 className="font-semibold">Communes ({groups.length})</h3>
              <p className="mb-2 text-xs text-[#59645f]">
                {locatedCount} bien(s) sur {properties.length} positionné(s)
              </p>
              <ul className="grid gap-1">
                {groups.map((group) => (
                  <li key={group.centre.code}>
                    <button
                      type="button"
                      onClick={() => setSelectedCode(group.centre.code)}
                      className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm hover:bg-[#dce5d7]"
                    >
                      <span>{group.centre.name}</span>
                      <strong>{group.properties.length}</strong>
                    </button>
                  </li>
                ))}
              </ul>
              {unlocated.length && !pending ? (
                <details
                  className="mt-3 border-t border-[#dfddd4] pt-3"
                  open={!groups.length}
                >
                  <summary className="cursor-pointer text-sm font-semibold">
                    Biens sans repère ({unlocated.length})
                  </summary>
                  {unlocated.map(renderRow)}
                </details>
              ) : null}
            </>
          )}
        </CommercialPanel>
      </div>
    </section>
  );
}
