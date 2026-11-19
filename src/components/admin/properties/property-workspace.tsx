"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { homeFeaturedPropertyLimit, type Property } from "@/data/properties";
import {
  BentoCardSkeleton,
  BentoEmptyState,
} from "@/components/admin/bento/bento-states";
import { CommercialDialog } from "@/components/commercial/commercial-design-ui";
import { commercialSecondaryButton } from "@/components/commercial/commercial-ui";
import {
  propertyMutationPayload,
  propertyCanAppearOnHome,
  type PropertyDraft,
  type PropertyPerson,
} from "@/lib/property-workspace";
import { PropertyDetail } from "./property-detail";
import { PropertyActionsDialog } from "./property-actions";
import { PropertyPortfolio } from "./property-portfolio";
import { propertyPrimaryButton } from "./property-ui";
import { PropertyWizard, propertyRequest } from "./property-wizard";

export type PropertyEditorProps = {
  property: Property;
  onPersist: (property: Property) => Promise<boolean>;
};

function setPropertyUrl(id: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "properties");
  url.searchParams.delete("contact");
  if (id) url.searchParams.set("property", id);
  else url.searchParams.delete("property");
  window.history.replaceState(null, "", url);
}

function Workshop(
  props: Omit<Parameters<typeof PropertyWizard>[0], "draftId">,
) {
  const [draftId] = useState(() => props.draft?.id ?? crypto.randomUUID());
  return <PropertyWizard {...props} draftId={draftId} />;
}

export function PropertyWorkspace({
  properties,
  setProperties,
  connected,
  loading,
  catalogueError,
  canWrite,
  canDelete,
  canCreateOffer,
  createOpen,
  onCreateOpenChange,
  registerCreateLeave,
  initialPropertyId,
  renderEditor,
}: {
  properties: Property[];
  setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  connected: boolean;
  loading: boolean;
  catalogueError: string;
  canWrite: boolean;
  canDelete: boolean;
  canCreateOffer: boolean;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  registerCreateLeave?: Parameters<typeof PropertyWizard>[0]["registerLeave"];
  initialPropertyId: string | null;
  renderEditor: (props: PropertyEditorProps) => ReactNode;
}) {
  const [selectedId, setSelectedId] = useState(initialPropertyId);
  const [managedId, setManagedId] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<string | null>(null);
  const portfolioScroll = useRef(0);
  const portfolioRoot = useRef<HTMLDivElement>(null);
  const [owners, setOwners] = useState<PropertyPerson[]>([]);
  const [advisors, setAdvisors] = useState<PropertyPerson[]>([]);
  const [drafts, setDrafts] = useState<PropertyDraft[]>([]);
  const [draftListOpen, setDraftListOpen] = useState(false);
  const [activeDraft, setActiveDraft] = useState<PropertyDraft | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);
  const [optionsError, setOptionsError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const selected = properties.find((property) => property.id === selectedId);
  const managed = properties.find((property) => property.id === managedId);
  const writable = canWrite && connected;
  const homeFeaturedIds = useMemo(
    () =>
      new Set(
        properties
          .filter(
            (property) =>
              property.featured && propertyCanAppearOnHome(property),
          )
          .sort(
            (a, b) =>
              b.updatedAt.localeCompare(a.updatedAt) ||
              a.id.localeCompare(b.id),
          )
          .slice(0, homeFeaturedPropertyLimit)
          .map(({ id }) => id),
      ),
    [properties],
  );

  function closeDialog() {
    setManagedId(null);
    requestAnimationFrame(() => {
      if (document.activeElement === document.body)
        portfolioRoot.current?.focus({ preventScroll: true });
    });
  }

  const loadOptions = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await propertyRequest<{
          owners: PropertyPerson[];
          advisors: PropertyPerson[];
        }>("/api/admin/properties/options", { signal });
        if (!signal?.aborted) {
          setOwners(result.owners);
          setAdvisors(result.advisors);
        }
        if (writable) {
          const saved = await propertyRequest<{ drafts: PropertyDraft[] }>(
            "/api/admin/properties/drafts",
            { signal },
          );
          if (!signal?.aborted) setDrafts(saved.drafts);
        }
        if (!signal?.aborted) setOptionsError("");
      } catch (error) {
        if (!signal?.aborted)
          setOptionsError(
            error instanceof Error
              ? error.message
              : "Les données du portefeuille sont indisponibles.",
          );
      }
    },
    [writable],
  );

  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => loadOptions(controller.signal));
    return () => controller.abort();
  }, [connected, loadOptions]);

  function upsert(property: Property) {
    setProperties((current) => [
      property,
      ...current.filter((item) => item.id !== property.id),
    ]);
  }

  async function refreshCatalogue() {
    setRetrying(true);
    try {
      const result = await propertyRequest<{ properties: Property[] }>(
        "/api/admin/properties",
      );
      setProperties(result.properties);
      setRetryMessage("");
      await loadOptions();
    } catch (error) {
      setRetryMessage(
        error instanceof Error
          ? error.message
          : "Le portefeuille n’a pas pu être rechargé.",
      );
    } finally {
      setRetrying(false);
    }
  }

  async function persistProperty(property: Property) {
    setFeedback(null);
    if (!writable) return false;
    try {
      const response = await propertyRequest<{ property: Property }>(
        "/api/admin/properties",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(propertyMutationPayload(property)),
        },
      );
      upsert(response.property);
      setFeedback({ message: "Bien mis à jour." });
      return true;
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error ? error.message : "La mise à jour a échoué.",
        error: true,
      });
      return false;
    }
  }

  function openProperty(property: Property, rememberScroll = true) {
    if (rememberScroll) portfolioScroll.current = window.scrollY;
    setFeedback(null);
    setSelectedId(property.id);
    setPropertyUrl(property.id);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function closeProperty() {
    setSelectedId(null);
    setManagedId(null);
    setPropertyUrl(null);
    setFeedback(null);
    requestAnimationFrame(() =>
      window.scrollTo({ top: portfolioScroll.current, behavior: "instant" }),
    );
  }

  function startDraft(draft: PropertyDraft | null) {
    portfolioScroll.current = window.scrollY;
    setDraftListOpen(false);
    setActiveDraft(draft);
    setFeedback(null);
    onCreateOpenChange(true);
    window.scrollTo({ top: 0 });
  }

  const error = retryMessage ?? catalogueError;
  const showingWizard = createOpen && writable;
  return (
    <div id="crm-create-property" className="grid min-w-0 grid-cols-1 gap-4">
      {!connected ? (
        <p
          role="alert"
          className="rounded-lg bg-[#f8ded9] p-3 text-sm text-[#943f37]"
        >
          Supabase doit être configuré pour consulter et modifier le
          portefeuille.
        </p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-lg bg-[#f8ded9] p-3 text-sm text-[#943f37]"
        >
          {error}
          <button
            type="button"
            onClick={() => void refreshCatalogue()}
            className="underline"
            disabled={retrying}
          >
            Réessayer
          </button>
        </div>
      ) : null}
      {optionsError ? (
        <div
          role="alert"
          className="flex flex-wrap gap-2 text-sm text-[#943f37]"
        >
          {optionsError}
          <button
            type="button"
            className="underline"
            onClick={() => void loadOptions()}
          >
            Recharger les références et brouillons
          </button>
        </div>
      ) : null}
      {feedback ? (
        <div
          role={feedback.error ? "alert" : "status"}
          className={
            feedback.error
              ? "rounded-lg bg-[#f8ded9] p-3 text-sm text-[#943f37]"
              : "rounded-lg bg-[#dce5d7] p-3 text-sm text-[#274331]"
          }
        >
          {feedback.message}
          {feedback.error ? (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => void refreshCatalogue()}
              disabled={retrying}
            >
              Recharger les biens
            </button>
          ) : null}
        </div>
      ) : null}
      {loading && !properties.length ? <BentoCardSkeleton /> : null}
      <div
        ref={portfolioRoot}
        tabIndex={-1}
        className="min-w-0"
        hidden={Boolean(
          selectedId || showingWizard || (loading && !properties.length),
        )}
      >
        <PropertyPortfolio
          properties={properties}
          advisors={advisors}
          canWrite={writable}
          onCreate={() => startDraft(null)}
          onOpen={openProperty}
          onManage={(property) => setManagedId(property.id)}
          draftActions={
            writable && drafts.length ? (
              <button
                type="button"
                className={commercialSecondaryButton}
                onClick={() => setDraftListOpen(true)}
              >
                Brouillons en cours ({drafts.length})
              </button>
            ) : null
          }
        />
      </div>
      {showingWizard ? (
        <Workshop
          key={activeDraft?.id ?? "creation"}
          draft={activeDraft}
          owners={owners}
          advisors={advisors}
          registerLeave={registerCreateLeave}
          onClose={() => {
            setActiveDraft(null);
            onCreateOpenChange(false);
            requestAnimationFrame(() =>
              window.scrollTo({
                top: portfolioScroll.current,
                behavior: "instant",
              }),
            );
          }}
          onSavedDraft={(draft) =>
            setDrafts((current) => [
              draft,
              ...current.filter((item) => item.id !== draft.id),
            ])
          }
          onSavedProperty={(property, retained) => {
            upsert(property);
            if (!retained)
              setDrafts((current) =>
                current.filter((item) => item.id !== property.id),
              );
            setActiveDraft(null);
            onCreateOpenChange(false);
            openProperty(property, false);
            setFeedback({
              message:
                (property.publicationStatus === "PUBLISHED"
                  ? "Bien publié sur le site."
                  : property.scheduledPublicationAt
                    ? "Publication programmée."
                    : "Bien enregistré dans le portefeuille.") +
                (retained
                  ? " Le brouillon de saisie est encore dans la liste."
                  : ""),
            });
          }}
        />
      ) : selected ? (
        <PropertyDetail
          key={selected.id}
          property={selected}
          owners={owners}
          advisors={advisors}
          canWrite={writable}
          canCreateOffer={canCreateOffer}
          visibleOnHome={homeFeaturedIds.has(selected.id)}
          onBack={closeProperty}
          onPersist={persistProperty}
          onManage={() => setManagedId(selected.id)}
          onScheduleUpdate={upsert}
          editor={renderEditor({
            property: selected,
            onPersist: persistProperty,
          })}
        />
      ) : selectedId && !loading && !error ? (
        <div className="grid gap-3">
          <BentoEmptyState
            title="Ce bien n’a pas été trouvé"
            description="Vérifiez le lien ou revenez au portefeuille."
          />
          <button
            type="button"
            className={`${commercialSecondaryButton} w-fit`}
            onClick={closeProperty}
          >
            Retour aux biens
          </button>
        </div>
      ) : null}
      {managed ? (
        <PropertyActionsDialog
          key={managed.id}
          property={managed}
          canWrite={writable}
          canDelete={writable && canDelete}
          visibleOnHome={homeFeaturedIds.has(managed.id)}
          fromDetail={selectedId === managed.id}
          onUpdate={upsert}
          onDelete={(property) => {
            setProperties((current) =>
              current.filter(({ id }) => id !== property.id),
            );
            if (selectedId === property.id) closeProperty();
            else setManagedId(null);
            setDeleted(property.title);
          }}
          onClose={closeDialog}
          onReturn={closeProperty}
        />
      ) : null}
      {deleted ? (
        <CommercialDialog
          title="Bien supprimé"
          onClose={() => {
            setDeleted(null);
            closeDialog();
          }}
        >
          <p role="status" className="mb-4 [overflow-wrap:anywhere]">
            Le bien « {deleted} » a été supprimé définitivement.
          </p>
          <button
            type="button"
            className={propertyPrimaryButton}
            onClick={() => {
              setDeleted(null);
              closeDialog();
            }}
          >
            Retour aux biens
          </button>
        </CommercialDialog>
      ) : null}
      {draftListOpen ? (
        <CommercialDialog
          title="Reprendre un brouillon"
          onClose={() => setDraftListOpen(false)}
        >
          <ul className="grid gap-2">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dfddd4] p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold [overflow-wrap:anywhere]">
                    {draft.form.title || "Bien sans titre"}
                  </p>
                  <p className="text-xs text-[#59645f]">
                    Étape {draft.step + 1} sur 8 ·{" "}
                    {new Date(draft.updatedAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <button
                  type="button"
                  className={commercialSecondaryButton}
                  onClick={() => startDraft(draft)}
                >
                  Reprendre
                </button>
              </li>
            ))}
          </ul>
        </CommercialDialog>
      ) : null}
    </div>
  );
}
