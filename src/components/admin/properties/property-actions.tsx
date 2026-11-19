"use client";

import { useEffect, useRef, useState } from "react";
import { CommercialDialog } from "@/components/commercial/commercial-design-ui";
import { homeFeaturedPropertyLimit, type Property } from "@/data/properties";
import {
  propertyAvailability,
  propertyCanAppearOnHome,
  propertyPublicationLabels,
  type PropertyAction,
  type PropertyActionUpdate,
} from "@/lib/property-workspace";
import { cn } from "@/lib/utils";
import { propertyRequest } from "./property-wizard";
import { propertyPrimaryButton, propertySecondaryButton } from "./property-ui";
const deleteButton = cn(
  propertySecondaryButton,
  "border-[#993d35] bg-[#fbfaf7] text-[#993d35] hover:bg-[#f8ded9] focus-visible:outline-[#993d35]",
);
const confirmDeleteButton = cn(
  propertyPrimaryButton,
  "bg-[#993d35] hover:bg-[#783228] focus-visible:outline-[#993d35]",
);

export function PropertyActionsDialog({
  property,
  canWrite,
  canDelete,
  visibleOnHome,
  fromDetail,
  onUpdate,
  onDelete,
  onClose,
  onReturn,
}: {
  property: Property;
  canWrite: boolean;
  canDelete: boolean;
  visibleOnHome: boolean;
  fromDetail: boolean;
  onUpdate: (property: Property) => void;
  onDelete: (property: Property) => void;
  onClose: () => void;
  onReturn: () => void;
}) {
  const [panel, setPanel] = useState<"actions" | "confirm" | "archived">(
    "actions",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const submitting = useRef(false);
  const cancelButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (panel !== "actions") cancelButton.current?.focus();
  }, [panel]);
  const archived = property.publicationStatus === "ARCHIVED";
  const published = property.publicationStatus === "PUBLISHED";
  const eligibleForHome = propertyCanAppearOnHome(property);
  const endpoint = `/api/admin/properties/${encodeURIComponent(property.id)}/actions`;

  async function run(
    action: PropertyAction | { action: "delete" },
    message: string,
  ) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      if (action.action === "delete") {
        await propertyRequest(endpoint, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedUpdatedAt: property.updatedAt,
            confirm: true,
          }),
        });
        onDelete(property);
        return;
      }
      const { result } = await propertyRequest<{
        result: PropertyActionUpdate;
      }>(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...action,
          expectedUpdatedAt: property.updatedAt,
        }),
      });
      const { historyEvent, ...changes } = result;
      onUpdate({
        ...property,
        ...changes,
        history: historyEvent
          ? [historyEvent, ...(property.history ?? [])]
          : property.history,
      });
      setPanel(action.action === "archive" ? "archived" : "actions");
      setFeedback(message);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "L’action a échoué. Réessayez.",
      );
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  const title =
    panel === "confirm"
      ? "Supprimer ce bien ?"
      : panel === "archived"
        ? "Bien archivé"
        : "Actions du bien";
  return (
    <CommercialDialog title={title} onClose={onClose} dismissible={!busy}>
      <div className="grid min-w-0 gap-4">
        <p className="font-semibold [overflow-wrap:anywhere]">
          {property.title} · Réf. {property.reference}
        </p>
        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-[#f8ded9] p-3 text-sm text-[#943f37]"
          >
            {error}
          </p>
        ) : null}
        {busy ? (
          <p role="status" className="text-sm">
            Enregistrement en cours…
          </p>
        ) : null}
        {panel === "confirm" ? (
          <>
            <p className="text-sm">
              Le bien sera retiré du site et de la page d’accueil. Son dossier
              sera supprimé définitivement. Pour conserver son historique,
              choisissez plutôt l’archivage.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                ref={cancelButton}
                type="button"
                className={propertySecondaryButton}
                disabled={busy}
                onClick={() => {
                  setPanel("actions");
                  setError("");
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                className={propertySecondaryButton}
                disabled={busy}
                onClick={() => void run({ action: "archive" }, "")}
              >
                Archiver plutôt
              </button>
              <button
                type="button"
                className={confirmDeleteButton}
                disabled={busy}
                onClick={() => void run({ action: "delete" }, "")}
              >
                Supprimer définitivement
              </button>
            </div>
          </>
        ) : panel === "archived" ? (
          <>
            <p role="status" className="text-sm">
              Le bien a été archivé. Il n’apparaît plus sur le site ni sur la
              page d’accueil. Son dossier et son historique sont conservés.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={propertyPrimaryButton}
                disabled={busy}
                onClick={() =>
                  void run({ action: "restore" }, "Bien restauré en brouillon.")
                }
              >
                Annuler l’archivage
              </button>
              <button
                ref={cancelButton}
                type="button"
                className={propertySecondaryButton}
                disabled={busy}
                onClick={fromDetail ? onReturn : onClose}
              >
                Retour aux biens
              </button>
            </div>
          </>
        ) : (
          <>
            {feedback ? (
              <p role="status" className="rounded-xl bg-[#dce5d7] p-3 text-sm">
                {feedback}
              </p>
            ) : null}
            <fieldset
              className="grid gap-2 rounded-xl border border-[#dfddd4] p-3"
              disabled={busy}
            >
              <legend className="px-1 text-sm font-semibold">
                Disponibilité du bien
              </legend>
              <p className="text-sm">{propertyAvailability[property.status]}</p>
              {canWrite && !archived ? (
                <div className="flex flex-wrap gap-2">
                  {(["available", "under_offer", "sold"] as const).map(
                    (value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={value === property.status}
                        className={
                          value === property.status
                            ? propertyPrimaryButton
                            : propertySecondaryButton
                        }
                        onClick={() =>
                          void run(
                            { action: "availability", value },
                            "Disponibilité mise à jour.",
                          )
                        }
                      >
                        {propertyAvailability[value]}
                      </button>
                    ),
                  )}
                </div>
              ) : null}
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <section className="grid content-start gap-2 rounded-xl border border-[#dfddd4] p-3">
                <h3 className="text-sm font-semibold">Publication</h3>
                <p className="text-sm">
                  {
                    propertyPublicationLabels[
                      property.publicationStatus ?? "DRAFT"
                    ]
                  }
                </p>
                {canWrite && !archived ? (
                  <button
                    type="button"
                    className={propertySecondaryButton}
                    disabled={
                      busy || (!published && property.status === "sold")
                    }
                    onClick={() =>
                      void run(
                        { action: published ? "unpublish" : "publish" },
                        published
                          ? "Bien dépublié."
                          : "Bien publié sur le site.",
                      )
                    }
                  >
                    {published ? "Dépublier" : "Publier sur le site"}
                  </button>
                ) : null}
              </section>
              <section className="grid content-start gap-2 rounded-xl border border-[#dfddd4] p-3">
                <h3 className="text-sm font-semibold">Accueil du site</h3>
                <p className="text-sm">
                  {visibleOnHome ? "À la une" : "Absent de la une"}
                </p>
                {property.featured && eligibleForHome && !visibleOnHome ? (
                  <p className="text-xs text-[#59645f]">
                    La mise à la une est activée. L’accueil affiche les{" "}
                    {homeFeaturedPropertyLimit} biens les plus récemment mis à
                    jour.
                  </p>
                ) : null}
                {canWrite && !archived && !eligibleForHome ? (
                  <p className="text-xs text-[#59645f]">
                    Le bien doit être publié et disponible ou réservé pour
                    apparaître à la une.
                  </p>
                ) : null}
                {canWrite && !archived ? (
                  <button
                    type="button"
                    className={propertySecondaryButton}
                    disabled={busy || (!property.featured && !eligibleForHome)}
                    onClick={() =>
                      void run(
                        { action: "feature", value: !property.featured },
                        property.featured
                          ? "Bien retiré de la une."
                          : "Mise à la une enregistrée.",
                      )
                    }
                  >
                    {property.featured
                      ? "Retirer de la une"
                      : "Mettre à la une"}
                  </button>
                ) : null}
              </section>
            </div>
            {canWrite ? (
              <div className="flex flex-wrap gap-2 border-t border-[#dfddd4] pt-3">
                <button
                  type="button"
                  className={propertySecondaryButton}
                  disabled={busy}
                  onClick={() =>
                    void run(
                      { action: archived ? "restore" : "archive" },
                      archived ? "Bien restauré en brouillon." : "",
                    )
                  }
                >
                  {archived ? "Restaurer" : "Archiver"}
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    className={deleteButton}
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      setPanel("confirm");
                    }}
                  >
                    Supprimer
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </CommercialDialog>
  );
}
