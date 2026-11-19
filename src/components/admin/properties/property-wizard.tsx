"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, Check, FileText, ImagePlus } from "lucide-react";
import { CommercialDialog } from "@/components/commercial/commercial-design-ui";
import {
  formatPrice,
  propertyTypeLabels,
  type Property,
} from "@/data/properties";
import { getClimateAssessment, getEnergyAssessment } from "@/lib/dpe";
import {
  CommercialPanel,
  commercialSecondaryButton,
  fieldClass,
} from "@/components/commercial/commercial-ui";
import {
  documentKindLabels,
  documentKinds,
  draftAssetSchema,
  draftAssetsSchema,
  emptyPropertyDraft,
  parsePropertyNumber,
  propertyDocumentLimit,
  propertyDocumentUrl,
  propertyDraftErrors,
  propertyDraftFormSchema,
  propertyKinds,
  propertyMutationPayload,
  propertyPublicationCompleteness,
  requiredPropertyDocuments,
  requiredPropertyPhotos,
  type PropertyDraft,
  type PropertyDraftAsset,
  type PropertyDraftForm,
  type PropertyPerson,
  type PropertyWorkspaceDetails,
} from "@/lib/property-workspace";
import { cn } from "@/lib/utils";
import { propertyPrimaryButton, propertySecondaryButton } from "./property-ui";
import styles from "./property-layout.module.css";

const steps = [
  "Informations",
  "Localisation",
  "Caractéristiques",
  "DPE et diagnostics",
  "Médias",
  "Description",
  "Documents",
  "Validation",
];
const fieldSteps: Partial<Record<keyof PropertyDraftForm, number>> = {
  title: 0,
  price: 0,
  city: 1,
  postalCode: 1,
  latitude: 1,
  longitude: 1,
  surface: 2,
  landSurface: 2,
  bedrooms: 2,
  rooms: 2,
  bathrooms: 2,
  energyClass: 3,
  climateClass: 3,
  descriptionShort: 5,
};
type QueuedDocument = {
  id: string;
  file: File;
  kind: (typeof documentKinds)[number];
  folderId?: string;
};
type WizardAsset = {
  metadata: PropertyDraftAsset;
  file?: File;
  preview?: string;
};

function draftAssetUrl(draftId: string, assetId: string) {
  return `/api/admin/properties/drafts/assets?${new URLSearchParams({ draft: draftId, asset: assetId })}`;
}

export function PropertyField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
      {error ? (
        <span className="text-xs font-normal text-[#a33a30]">{error}</span>
      ) : null}
    </label>
  );
}

export function PropertyPersonField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: PropertyPerson[];
  onChange: (value: string) => void;
}) {
  return (
    <PropertyField label={label}>
      <select
        aria-label={label}
        className={cn(fieldClass, "w-full")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Non renseigné</option>
        {value && !options.some((item) => item.id === value) ? (
          <option value={value}>
            Contact ou profil hors du référentiel courant
          </option>
        ) : null}
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </PropertyField>
  );
}

const extraFields = {
  address: [
    ["district", "Quartier ou secteur", "text"],
    ["floor", "Étage", "text"],
  ],
  structure: [
    ["heating", "Chauffage", "text"],
    ["exposure", "Exposition", "text"],
  ],
  diagnostics: [
    ["diagnosticsDate", "Date des diagnostics", "date"],
    ["diagnostician", "Diagnostiqueur", "text"],
  ],
  legal: [
    ["propertyTax", "Taxe foncière annuelle (€)", "text"],
    ["condoFees", "Charges de copropriété annuelles (€)", "text"],
  ],
} as const;

export function PropertyAdditionalFields({
  group,
  value,
  onChange,
}: {
  group: keyof typeof extraFields;
  value: PropertyWorkspaceDetails;
  onChange: (detail: PropertyWorkspaceDetails) => void;
}) {
  return (
    <>
      {extraFields[group].map(([key, label, type]) => (
        <PropertyField key={key} label={label}>
          <input
            className={fieldClass}
            type={type}
            value={value[key]}
            onChange={(event) =>
              onChange({ ...value, [key]: event.target.value })
            }
          />
        </PropertyField>
      ))}
      {group === "legal"
        ? (
            [
              ["condo", "Copropriété"],
              ["pendingProceeding", "Procédure en cours"],
            ] as const
          ).map(([key, label]) => (
            <PropertyField key={key} label={label}>
              <select
                aria-label={label}
                className={fieldClass}
                value={value[key]}
                onChange={(event) =>
                  onChange({
                    ...value,
                    [key]: event.target.value as (typeof value)[typeof key],
                  })
                }
              >
                <option value="">Non renseigné</option>
                <option value="yes">Oui</option>
                <option value="no">Non</option>
              </select>
            </PropertyField>
          ))
        : null}
      {group === "structure" ? (
        <div className="grid gap-2 md:col-span-2">
          <h4 className="text-sm font-semibold">Détail des pièces</h4>
          {value.roomDetails.map((room, index) => (
            <div
              className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)_auto]"
              key={index}
            >
              <PropertyField label={`Pièce ${index + 1}`}>
                <input
                  className={fieldClass}
                  placeholder="Ex. Séjour"
                  value={room.label}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      roomDetails: value.roomDetails.map((item, i) =>
                        i === index ? { ...item, label: e.target.value } : item,
                      ),
                    })
                  }
                />
              </PropertyField>
              <PropertyField label={`Surface pièce ${index + 1} (m²)`}>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  value={room.surface}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      roomDetails: value.roomDetails.map((item, i) =>
                        i === index
                          ? { ...item, surface: e.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </PropertyField>
              <button
                type="button"
                className={cn(commercialSecondaryButton, "w-fit")}
                aria-label={`Retirer la pièce ${index + 1}`}
                onClick={() =>
                  onChange({
                    ...value,
                    roomDetails: value.roomDetails.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              >
                Retirer
              </button>
            </div>
          ))}
          <button
            type="button"
            className={cn(commercialSecondaryButton, "w-fit")}
            disabled={value.roomDetails.length >= 50}
            onClick={() =>
              onChange({
                ...value,
                roomDetails: [...value.roomDetails, { label: "", surface: "" }],
              })
            }
          >
            Ajouter une pièce
          </button>
        </div>
      ) : null}
    </>
  );
}

export async function propertyRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const fieldMessage = payload?.fieldErrors
      ? Object.values(payload.fieldErrors)[0]
      : null;
    throw new Error(
      typeof fieldMessage === "string"
        ? fieldMessage
        : (payload?.message ?? "Le serveur n’a pas pu terminer l’opération."),
    );
  }
  return payload as T;
}

export async function uploadPropertyDocument(
  propertyId: string,
  document: QueuedDocument,
) {
  const body = new FormData();
  body.set("id", document.id);
  body.set("kind", document.kind);
  body.set("file", document.file);
  if (document.folderId) body.set("folderId", document.folderId);
  return propertyRequest(propertyDocumentUrl(propertyId), {
    method: "POST",
    body,
  });
}

export async function uploadPropertyPhoto(
  file: File,
  draftAsset?: { draftId: string; assetId: string },
) {
  const body = new FormData();
  body.append("photos", file);
  if (draftAsset) {
    body.set("draftId", draftAsset.draftId);
    body.set("assetId", draftAsset.assetId);
  }
  const result = await propertyRequest<{ photos: { url: string }[] }>(
    "/api/admin/property-photos",
    { method: "POST", body },
  );
  if (!result.photos[0]?.url)
    throw new Error("Le stockage n’a pas retourné la photo.");
  return result.photos[0].url;
}

export async function schedulePropertyPublication(
  property: Property,
  date: string | null,
) {
  const scheduled = date ? new Date(date) : null;
  if (scheduled && !(scheduled.getTime() > Date.now()))
    throw new Error("Choisissez une date future pour la publication.");
  const result = await propertyRequest<{
    updatedAt: string;
    scheduledPublicationAt: string | null;
  }>(`/api/admin/properties/${property.id}/publication`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scheduledAt: scheduled?.toISOString() ?? null,
      expectedUpdatedAt: property.updatedAt,
    }),
  });
  return { ...property, ...result, publicationScheduleError: null };
}

export function PropertyWizard({
  draft,
  draftId,
  owners,
  advisors,
  onSavedDraft,
  onSavedProperty,
  onClose,
  registerLeave,
}: {
  draft: PropertyDraft | null;
  draftId: string;
  owners: PropertyPerson[];
  advisors: PropertyPerson[];
  onSavedDraft: (draft: PropertyDraft) => void;
  onSavedProperty: (property: Property, retainedDraft: boolean) => void;
  onClose: () => void;
  registerLeave?: (handler: ((after?: () => void) => void) | null) => void;
}) {
  const [form, setForm] = useState(draft?.form ?? emptyPropertyDraft);
  const [step, setStep] = useState(draft?.step ?? 0);
  const revision = useRef(draft?.updatedAt);
  const inFlight = useRef(false);
  const afterLeave = useRef<(() => void) | undefined>(undefined);
  const staged = useRef(new Set(draft?.attachments?.map(({ id }) => id)));
  const previewUrls = useRef(new Set<string>());
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);
  const [attachments, setAttachments] = useState<WizardAsset[]>(() =>
    (draft?.attachments ?? []).map((metadata) => ({ metadata })),
  );
  const [dialog, setDialog] = useState<"leave" | "saved" | null>(null);
  const [savedProperty, setSavedProperty] = useState<Property | null>(null);
  const [validation, setValidation] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const photos = attachments.filter(
    ({ metadata }) => metadata.kind === "photo",
  );
  const documents = attachments.filter(
    ({ metadata }) => metadata.kind !== "photo",
  );
  const completeness = propertyPublicationCompleteness(
    photos.length,
    documents.map(({ metadata }) => metadata.kind),
  );
  const errors = propertyDraftErrors(form);
  const publishBlocked =
    Object.keys(errors).length > 0 ||
    completeness.missingPhotos > 0 ||
    completeness.missingDocuments.length > 0;
  const errorsForStep = Object.entries(errors).filter(
    ([field]) => fieldSteps[field as keyof PropertyDraftForm] === step,
  );
  const skipDiagnostics = form.type === "land" || form.type === "parking";

  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (!dirty && !busy) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, busy]);

  const close = useCallback(
    (after?: () => void) => {
      if (inFlight.current) return;
      if (dirty) {
        afterLeave.current = after;
        setFeedback(null);
        setDialog("leave");
      } else {
        onClose();
        after?.();
      }
    },
    [dirty, onClose],
  );

  useEffect(() => {
    registerLeave?.(close);
    return () => registerLeave?.(null);
  }, [close, registerLeave]);

  function changeAssets(assets: WizardAsset[]) {
    setAttachments(assets);
    setDirty(true);
  }

  function addFiles(files: File[], kind: PropertyDraftAsset["kind"]) {
    if (!files.length || inFlight.current) return;
    const parsed = files.map((file) => ({
      file,
      data: draftAssetSchema.safeParse({
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type,
        kind,
      }),
    }));
    if (
      parsed.some(
        ({ file, data }) =>
          !data.success || !file.size || file.size > propertyDocumentLimit,
      ) ||
      attachments.length + files.length > 36 ||
      (kind === "photo" && photos.length + files.length > 12)
    ) {
      setFeedback({
        error: true,
        message:
          "Choisissez des fichiers au format accepté, de 4 Mio maximum. Le dossier accepte 12 photos et 36 fichiers au total.",
      });
      return;
    }
    setFeedback(null);
    changeAssets([
      ...attachments,
      ...parsed.flatMap(({ data, file }) => {
        if (!data.success) return [];
        const preview =
          kind === "photo" ? URL.createObjectURL(file) : undefined;
        if (preview) previewUrls.current.add(preview);
        return [{ metadata: data.data, file, preview }];
      }),
    ]);
  }

  async function readFile(asset: WizardAsset) {
    if (asset.file) return asset.file;
    const response = await fetch(draftAssetUrl(draftId, asset.metadata.id));
    if (!response.ok)
      throw new Error(
        `Le fichier « ${asset.metadata.name} » n’a pas pu être récupéré.`,
      );
    return new File([await response.blob()], asset.metadata.name, {
      type: asset.metadata.mimeType,
    });
  }

  function update<T extends keyof PropertyDraftForm>(
    field: T,
    value: PropertyDraftForm[T],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
  }

  function input(
    field: Exclude<keyof PropertyDraftForm, "workspaceDetails" | "type">,
    label: string,
    mode?: "decimal" | "numeric",
  ) {
    return (
      <PropertyField
        label={label}
        error={validation ? errors[field] : undefined}
      >
        <input
          className={cn(fieldClass, "w-full")}
          value={form[field]}
          inputMode={mode}
          aria-invalid={validation && Boolean(errors[field])}
          onChange={(event) => update(field, event.target.value)}
        />
      </PropertyField>
    );
  }

  async function saveDraft() {
    const parsed = propertyDraftFormSchema.safeParse(form);
    if (!parsed.success)
      throw new Error(
        "Vérifiez les longueurs des champs et utilisez des liens HTTPS valides.",
      );
    const metadata = draftAssetsSchema.parse(
      attachments.map((asset) => asset.metadata),
    );
    for (const asset of attachments) {
      if (staged.current.has(asset.metadata.id)) continue;
      const body = new FormData();
      body.set("file", await readFile(asset));
      body.set("kind", asset.metadata.kind);
      await propertyRequest(draftAssetUrl(draftId, asset.metadata.id), {
        method: "POST",
        body,
      });
      staged.current.add(asset.metadata.id);
    }
    const result = await propertyRequest<{ draft: PropertyDraft }>(
      "/api/admin/properties/drafts",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draftId,
          step,
          form: parsed.data,
          attachments: metadata,
          expectedUpdatedAt: revision.current,
        }),
      },
    );
    revision.current = result.draft.updatedAt;
    onSavedDraft(result.draft);
    setDirty(false);
  }

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      await action();
    } catch (error) {
      setFeedback({
        error: true,
        message:
          error instanceof Error ? error.message : "L’opération a échoué.",
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function exitWizard() {
    const after = afterLeave.current;
    afterLeave.current = undefined;
    onClose();
    after?.();
  }

  async function finish(publish: boolean, scheduleDate?: string) {
    setValidation(true);
    if (Object.keys(errors).length) {
      setFeedback({
        error: true,
        message: "Corrigez les champs indiqués dans le récapitulatif.",
      });
      return;
    }
    if ((publish || scheduleDate) && publishBlocked) return;
    if (scheduleDate && !(Date.parse(scheduleDate) > Date.now())) {
      setFeedback({
        error: true,
        message: "Choisissez une date future pour la publication.",
      });
      return;
    }
    await run(async () => {
      await saveDraft();
      const urls: string[] = [];
      for (const photo of photos) {
        urls.push(
          await uploadPropertyPhoto(await readFile(photo), {
            draftId,
            assetId: photo.metadata.id,
          }),
        );
      }
      const payload = {
        ...form,
        status: "available",
        publicationStatus: "DRAFT",
        photoUrls: urls,
        featured: false,
        draftId,
      };
      let property = savedProperty;
      let needsUpdate = Boolean(savedProperty);
      if (!property) {
        const response = await propertyRequest<{
          property: Property;
          reused?: boolean;
        }>("/api/admin/properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        property = response.property;
        setSavedProperty(property);
        needsUpdate = Boolean(response.reused);
        if (
          response.reused &&
          property.publicationStatus === "DRAFT" &&
          !urls.length
        )
          urls.push(...property.photos);
      }
      if (needsUpdate && property.publicationStatus === "DRAFT") {
        const response = await propertyRequest<{ property: Property }>(
          "/api/admin/properties",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...payload,
              photoUrls: urls,
              reference: property.reference,
              expectedUpdatedAt: property.updatedAt,
            }),
          },
        );
        property = response.property;
        setSavedProperty(property);
      }
      for (const doc of documents) {
        const { id, kind } = doc.metadata;
        if (kind !== "photo")
          await uploadPropertyDocument(property.id, {
            id,
            kind,
            file: await readFile(doc),
          });
      }
      if (publish && property.publicationStatus !== "PUBLISHED") {
        const response = await propertyRequest<{ property: Property }>(
          "/api/admin/properties",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...propertyMutationPayload(property),
              publicationStatus: "PUBLISHED",
            }),
          },
        );
        property = response.property;
        setSavedProperty(property);
      }
      if (scheduleDate) {
        property = await schedulePropertyPublication(property, scheduleDate);
        setSavedProperty(property);
      }
      let retainedDraft = false;
      try {
        await propertyRequest(`/api/admin/properties/drafts?id=${draftId}`, {
          method: "DELETE",
        });
      } catch {
        retainedDraft = true;
      }
      onSavedProperty(property, retainedDraft);
    });
  }

  const detail = form.workspaceDetails;
  const grid = "grid gap-4 md:grid-cols-2";
  const textarea = cn(fieldClass, "min-h-28 w-full py-2");
  return (
    <section
      className="grid min-w-0 gap-5 text-[#18211f]"
      aria-label="Création d’un bien"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">
            {step === 7
              ? "Vérification et publication"
              : "Ajouter un nouveau bien"}
          </h2>
          <p className="text-sm text-[#59645f]">
            Étape {step + 1} sur 8 · {steps[step]}
          </p>
        </div>
        <button
          type="button"
          className={propertySecondaryButton}
          onClick={() => close()}
          disabled={busy}
        >
          Retour aux biens
        </button>
      </header>
      <ol
        className={cn(
          "grid grid-cols-2 gap-2 text-xs sm:grid-cols-4",
          styles.wizardSteps,
        )}
      >
        {steps.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              disabled={busy}
              aria-current={step === index ? "step" : undefined}
              className={cn(
                "flex min-h-12 w-full items-center gap-1.5 rounded-xl border border-[#dfddd4] px-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f493a] sm:min-h-11",
                index < step && "border-transparent bg-[#dce5d7]",
                index === step &&
                  "border-transparent bg-[#2f493a] font-semibold text-white",
              )}
              onClick={() => setStep(index)}
            >
              <span className="inline-grid size-5 shrink-0 place-items-center rounded-full border border-current">
                {index < step ? (
                  <Check className="size-3" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      {feedback ? (
        <p
          role={feedback.error ? "alert" : "status"}
          className={cn(
            "rounded-lg p-3 text-sm",
            feedback.error
              ? "bg-[#f8ded9] text-[#943f37]"
              : "bg-[#dce5d7] text-[#274331]",
          )}
        >
          {feedback.message}
        </p>
      ) : null}
      <fieldset disabled={busy} className="min-w-0">
        <CommercialPanel className="grid gap-5 p-4 sm:p-6">
          {step === 0 ? (
            <div className={grid}>
              <PropertyField label="Type de bien">
                <select
                  className={fieldClass}
                  value={form.type}
                  onChange={(e) =>
                    update("type", e.target.value as PropertyDraftForm["type"])
                  }
                >
                  {propertyKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {propertyTypeLabels[kind]}
                    </option>
                  ))}
                </select>
              </PropertyField>
              {input("title", "Titre commercial *")}
              {input("price", "Prix affiché (€) *", "decimal")}
              <PropertyField label="Honoraires renseignés (€)">
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  value={detail.agencyFee}
                  onChange={(e) =>
                    update("workspaceDetails", {
                      ...detail,
                      agencyFee: e.target.value,
                    })
                  }
                />
              </PropertyField>
              {input("mandateNumber", "Référence du mandat")}
              <PropertyField label="Type de mandat prévu">
                <select
                  className={fieldClass}
                  value={detail.plannedMandateType}
                  onChange={(e) =>
                    update("workspaceDetails", {
                      ...detail,
                      plannedMandateType: e.target
                        .value as typeof detail.plannedMandateType,
                    })
                  }
                >
                  <option value="">Non renseigné</option>
                  <option value="simple">Simple</option>
                  <option value="exclusive">Exclusif</option>
                  <option value="semi_exclusive">Semi-exclusif</option>
                </select>
              </PropertyField>
              <PropertyPersonField
                label="Propriétaire"
                value={form.ownerContactId}
                options={owners}
                onChange={(value) => update("ownerContactId", value)}
              />
              <PropertyPersonField
                label="Conseiller responsable"
                value={form.advisorId}
                options={advisors}
                onChange={(value) => update("advisorId", value)}
              />
            </div>
          ) : null}
          {step === 1 ? (
            <div className={grid}>
              {input("city", "Commune *")}
              {input("postalCode", "Code postal *", "numeric")}
              {input("streetAddress", "Adresse exacte (interne)")}
              <p className="self-center text-sm text-[#59645f]">
                La fiche publique affiche uniquement la commune et le code
                postal.
              </p>
              {input("latitude", "Latitude (optionnelle)", "decimal")}
              {input("longitude", "Longitude (optionnelle)", "decimal")}
              <PropertyAdditionalFields
                group="address"
                value={detail}
                onChange={(value) => update("workspaceDetails", value)}
              />
            </div>
          ) : null}
          {step === 2 ? (
            <div className={grid}>
              {input(
                "surface",
                form.type === "land"
                  ? "Surface du terrain (m²) *"
                  : "Surface du bien (m²) *",
                "decimal",
              )}
              {form.type !== "land"
                ? input("landSurface", "Surface terrain (m²)", "decimal")
                : null}
              {!skipDiagnostics ? (
                <>
                  {input("rooms", "Pièces", "numeric")}
                  {input("bedrooms", "Chambres", "numeric")}
                  {input("bathrooms", "Salles de bains", "numeric")}
                </>
              ) : null}
              <PropertyField label="Année de construction">
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  value={detail.constructionYear}
                  onChange={(e) =>
                    update("workspaceDetails", {
                      ...detail,
                      constructionYear: e.target.value,
                    })
                  }
                />
              </PropertyField>
              <PropertyField label="État général">
                <input
                  className={fieldClass}
                  value={detail.condition}
                  onChange={(e) =>
                    update("workspaceDetails", {
                      ...detail,
                      condition: e.target.value,
                    })
                  }
                />
              </PropertyField>
              <PropertyField label="Équipements et prestations (une ligne par élément)">
                <textarea
                  className={textarea}
                  value={form.featuresText}
                  onChange={(e) => update("featuresText", e.target.value)}
                />
              </PropertyField>
              {!skipDiagnostics ? (
                <PropertyAdditionalFields
                  group="structure"
                  value={detail}
                  onChange={(value) => update("workspaceDetails", value)}
                />
              ) : null}
              <PropertyAdditionalFields
                group="legal"
                value={detail}
                onChange={(value) => update("workspaceDetails", value)}
              />
            </div>
          ) : null}
          {step === 3 ? (
            skipDiagnostics ? (
              <p>
                Le DPE et le GES ne sont pas demandés pour cette catégorie dans
                le catalogue.
              </p>
            ) : (
              <div className={grid}>
                {input("energyClass", "Énergie (kWhEP/m²/an)", "decimal")}
                {input("climateClass", "Climat (kg CO₂/m²/an)", "decimal")}
                <p className="text-sm text-[#59645f]">
                  Classe énergie ·{" "}
                  {getEnergyAssessment(form.energyClass)?.letter ??
                    "Non renseignée"}
                </p>
                <p className="text-sm text-[#59645f]">
                  Classe GES ·{" "}
                  {getClimateAssessment(form.climateClass)?.letter ??
                    "Non renseignée"}
                </p>
                <PropertyAdditionalFields
                  group="diagnostics"
                  value={detail}
                  onChange={(value) => update("workspaceDetails", value)}
                />
                <p className="text-sm text-[#59645f]">
                  Joignez les justificatifs à l’étape Documents.
                </p>
              </div>
            )
          ) : null}
          {step === 4 ? (
            <>
              <div
                className="rounded-2xl border border-dashed border-[#99a596] bg-[#f7f8f3] p-4"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  addFiles(Array.from(event.dataTransfer.files), "photo");
                }}
              >
                <PropertyField label="Ajouter les photos (maximum 12, 4 Mio par fichier)">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    multiple
                    className={fieldClass}
                    onChange={(event) => {
                      addFiles(Array.from(event.target.files ?? []), "photo");
                      event.target.value = "";
                    }}
                  />
                </PropertyField>
                <p className="mt-2 text-sm text-[#59645f]">
                  Déposez les photos ici. Cinq photos sont requises pour
                  publier.
                </p>
              </div>
              <ul
                aria-label="Photos sélectionnées"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              >
                {photos.map((asset, index) => (
                  <li
                    key={asset.metadata.id}
                    className="grid min-w-0 gap-2 rounded-xl border border-[#dfddd4] p-2"
                  >
                    <div
                      className={cn(
                        "relative overflow-hidden rounded-lg bg-[#eeeae3]",
                        styles.draftPhotoPreview,
                      )}
                    >
                      <Image
                        src={
                          asset.preview ??
                          draftAssetUrl(draftId, asset.metadata.id)
                        }
                        alt=""
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <span className="text-sm [overflow-wrap:anywhere]">
                      {asset.metadata.name}
                      {index === 0 ? " · principale" : ""}
                    </span>
                    {index > 0 ? (
                      <button
                        type="button"
                        className={propertySecondaryButton}
                        onClick={() =>
                          changeAssets([
                            asset,
                            ...attachments.filter((item) => item !== asset),
                          ])
                        }
                      >
                        Définir en principale
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={propertySecondaryButton}
                      onClick={() =>
                        changeAssets(
                          attachments.filter((item) => item !== asset),
                        )
                      }
                    >
                      Retirer la photo
                    </button>
                  </li>
                ))}
                {Array.from(
                  {
                    length: Math.max(0, requiredPropertyPhotos - photos.length),
                  },
                  (_, index) => (
                    <li
                      key={index}
                      className={cn(
                        "grid place-items-center rounded-xl border border-dashed border-[#aab3a8] text-[#59645f]",
                        styles.draftPhotoPreview,
                      )}
                      aria-hidden="true"
                    >
                      <ImagePlus className="size-5" />
                    </li>
                  ),
                )}
              </ul>
              <div className={grid}>
                <PropertyField label="Vidéo (lien HTTPS)">
                  <input
                    type="url"
                    className={fieldClass}
                    value={detail.videoUrl}
                    onChange={(e) =>
                      update("workspaceDetails", {
                        ...detail,
                        videoUrl: e.target.value,
                      })
                    }
                  />
                </PropertyField>
                <PropertyField label="Visite virtuelle (lien HTTPS)">
                  <input
                    type="url"
                    className={fieldClass}
                    value={detail.tourUrl}
                    onChange={(e) =>
                      update("workspaceDetails", {
                        ...detail,
                        tourUrl: e.target.value,
                      })
                    }
                  />
                </PropertyField>
              </div>
            </>
          ) : null}
          {step === 5 ? (
            <>
              <PropertyField
                label="Description courte *"
                error={validation ? errors.descriptionShort : undefined}
              >
                <textarea
                  className={textarea}
                  maxLength={500}
                  value={form.descriptionShort}
                  onChange={(e) => update("descriptionShort", e.target.value)}
                />
                <span className="text-xs text-[#59645f]">
                  {form.descriptionShort.length}/500
                </span>
              </PropertyField>
              <PropertyField label="Description complète">
                <textarea
                  className={textarea}
                  maxLength={10000}
                  value={form.descriptionLong}
                  onChange={(e) => update("descriptionLong", e.target.value)}
                />
              </PropertyField>
            </>
          ) : null}
          {step === 6 ? (
            <>
              <div
                className="rounded-2xl border border-dashed border-[#99a596] bg-[#f7f8f3] p-4"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  addFiles(Array.from(event.dataTransfer.files), "other");
                }}
              >
                <PropertyField label="Ajouter un document privé (PDF, JPEG ou PNG, 4 Mio maximum)">
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    multiple
                    className={fieldClass}
                    onChange={(event) => {
                      addFiles(Array.from(event.target.files ?? []), "other");
                      event.target.value = "";
                    }}
                  />
                </PropertyField>
                <p className="mt-2 text-sm text-[#59645f]">
                  Déposez les pièces ici. Sélectionnez leur catégorie après
                  l’ajout.
                </p>
              </div>
              <div className="grid gap-2 text-sm">
                {Object.entries(requiredPropertyDocuments).map(
                  ([kind, name]) => (
                    <p key={kind} className="flex flex-wrap gap-2">
                      <strong>{name}</strong>
                      <span>
                        ·{" "}
                        {documents.some(
                          ({ metadata }) => metadata.kind === kind,
                        )
                          ? "Ajouté"
                          : "Obligatoire pour publier"}
                      </span>
                    </p>
                  ),
                )}
              </div>
              {documents.map((document) => {
                const { id, name, kind } = document.metadata;
                return (
                  <div
                    key={id}
                    className="flex flex-wrap items-center gap-3 text-sm"
                  >
                    <FileText aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {name}
                    </span>
                    <select
                      aria-label={`Catégorie de ${name}`}
                      className={fieldClass}
                      value={kind}
                      onChange={(event) => {
                        const kind = event.target
                          .value as QueuedDocument["kind"];
                        changeAssets(
                          attachments.map((item) =>
                            item.metadata.id === id
                              ? {
                                  ...item,
                                  metadata: { ...item.metadata, kind },
                                }
                              : item,
                          ),
                        );
                      }}
                    >
                      {documentKinds.map((kind) => (
                        <option value={kind} key={kind}>
                          {documentKindLabels[kind]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={propertySecondaryButton}
                      onClick={() =>
                        changeAssets(
                          attachments.filter((item) => item.metadata.id !== id),
                        )
                      }
                    >
                      Retirer le document
                    </button>
                  </div>
                );
              })}
            </>
          ) : null}
          {step === 7 ? (
            <>
              {publishBlocked ? (
                <div
                  role="status"
                  className={cn(
                    "grid gap-2 rounded-xl border p-4 text-sm",
                    styles.publicationWarning,
                  )}
                >
                  <p className="flex items-start gap-2 font-semibold">
                    <AlertTriangle
                      className="size-4 shrink-0 text-[#9b5e12]"
                      aria-hidden="true"
                    />
                    Dossier à compléter — publication indisponible
                  </p>
                  {completeness.missingPhotos > 0 ? (
                    <button
                      type="button"
                      className={`${propertySecondaryButton} w-fit max-w-full`}
                      onClick={() => setStep(4)}
                    >
                      {completeness.missingPhotos} photo(s) à ajouter
                    </button>
                  ) : null}
                  {completeness.missingDocuments.length ? (
                    <button
                      type="button"
                      className={`${propertySecondaryButton} w-fit max-w-full`}
                      onClick={() => setStep(6)}
                    >
                      Documents manquants ·{" "}
                      {completeness.missingDocuments.join(", ")}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">
                  Récapitulatif des informations saisies
                </h3>
                <span className="text-sm">
                  {Object.keys(errors).length
                    ? `${Object.keys(errors).length} champ(s) à corriger`
                    : "Champs obligatoires renseignés"}
                </span>
              </div>
              <div className="grid gap-2 text-sm">
                {[
                  [
                    0,
                    "Bien et prix",
                    `${form.title || "Titre manquant"} · ${form.price ? formatPrice(parsePropertyNumber(form.price)) : "Prix manquant"}`,
                  ],
                  [1, "Localisation", `${form.city} ${form.postalCode}`],
                  [
                    2,
                    "Surface",
                    form.surface ? `${form.surface} m²` : "Non renseignée",
                  ],
                  [
                    3,
                    "Diagnostics",
                    skipDiagnostics
                      ? "Non demandés"
                      : [form.energyClass, form.climateClass]
                          .filter(Boolean)
                          .join(" / ") || "Non renseignés",
                  ],
                  [
                    4,
                    "Médias",
                    `${photos.length} photo(s) sur ${requiredPropertyPhotos} requises`,
                  ],
                  [5, "Description", form.descriptionShort || "Non renseignée"],
                  [6, "Documents", `${documents.length} pièce(s) ajoutée(s)`],
                ].map(([index, label, value]) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-start justify-between gap-2 border-b border-[#dfddd4] pb-2"
                  >
                    <p className="min-w-0 [overflow-wrap:anywhere]">
                      <strong>{label}</strong> · {value}
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep(Number(index))}
                      className={`${propertySecondaryButton} shrink-0`}
                      aria-label={`Modifier ${label}`}
                    >
                      Modifier
                    </button>
                  </div>
                ))}
              </div>
              {Object.entries(errors).map(([field, message]) => (
                <button
                  type="button"
                  key={field}
                  className="text-left text-sm text-[#943f37] underline"
                  onClick={() => {
                    setValidation(true);
                    setStep(fieldSteps[field as keyof PropertyDraftForm] ?? 0);
                  }}
                >
                  {message}
                </button>
              ))}
              <PropertyField label="Date et heure de publication (heure locale)">
                <input
                  type="datetime-local"
                  className={cn(fieldClass, "w-fit max-w-full")}
                  value={scheduledDate}
                  disabled={publishBlocked}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </PropertyField>
              <p className="text-sm text-[#59645f]">
                Canal disponible : site IMMO DREAMS. Fuseau de saisie :{" "}
                {Intl.DateTimeFormat().resolvedOptions().timeZone}. Les portails
                externes nécessitent une connexion.
              </p>
            </>
          ) : null}
        </CommercialPanel>
      </fieldset>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-[#dfddd4] pt-4">
        <div className="flex flex-wrap gap-2">
          {step > 0 ? (
            <button
              type="button"
              className={propertySecondaryButton}
              disabled={busy}
              onClick={() => setStep(step - 1)}
            >
              Précédent
            </button>
          ) : (
            <button
              type="button"
              className={propertySecondaryButton}
              disabled={busy}
              onClick={() => close()}
            >
              Annuler
            </button>
          )}
          <button
            type="button"
            className={propertySecondaryButton}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await saveDraft();
                setDialog("saved");
              })
            }
          >
            {busy ? "Enregistrement…" : "Enregistrer le brouillon"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {step < 7 ? (
            <button
              type="button"
              className={propertyPrimaryButton}
              disabled={busy}
              onClick={() => {
                setValidation(true);
                if (!errorsForStep.length) setStep(step + 1);
              }}
            >
              Continuer
            </button>
          ) : (
            <>
              <button
                type="button"
                className={propertySecondaryButton}
                disabled={busy}
                onClick={() => void finish(false)}
              >
                Ajouter comme brouillon au portefeuille
              </button>
              {scheduledDate && !publishBlocked ? (
                <button
                  type="button"
                  className={propertySecondaryButton}
                  disabled={busy}
                  onClick={() => void finish(false, scheduledDate)}
                >
                  Programmer
                </button>
              ) : null}
              {publishBlocked ? (
                <button
                  type="button"
                  className={propertyPrimaryButton}
                  disabled={busy}
                  onClick={() => {
                    setValidation(true);
                    if (completeness.missingDocuments.length) setStep(6);
                    else if (completeness.missingPhotos) setStep(4);
                    else
                      setStep(
                        fieldSteps[
                          Object.keys(errors)[0] as keyof PropertyDraftForm
                        ] ?? 0,
                      );
                  }}
                >
                  {completeness.missingDocuments.length
                    ? "Compléter les documents"
                    : completeness.missingPhotos
                      ? "Compléter les médias"
                      : "Compléter les informations"}
                </button>
              ) : (
                <button
                  type="button"
                  className={propertyPrimaryButton}
                  disabled={busy}
                  onClick={() => void finish(true)}
                >
                  {busy ? "Enregistrement…" : "Publier sur le site"}
                </button>
              )}
            </>
          )}
        </div>
      </footer>
      {dialog === "saved" ? (
        <CommercialDialog
          title="Votre brouillon est enregistré"
          onClose={() => setDialog(null)}
        >
          <p role="status" className="mb-4 text-sm">
            Votre brouillon est enregistré. Vous pouvez quitter la création et
            la reprendre plus tard. Le bien n’est pas publié sur le site.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={propertyPrimaryButton}
              onClick={() => setDialog(null)}
            >
              Continuer la saisie
            </button>
            <button
              type="button"
              className={propertySecondaryButton}
              onClick={exitWizard}
            >
              Retour aux biens
            </button>
          </div>
        </CommercialDialog>
      ) : null}
      {dialog === "leave" ? (
        <CommercialDialog
          title="Quitter la création du bien ?"
          dismissible={!busy}
          onClose={() => {
            afterLeave.current = undefined;
            setDialog(null);
          }}
        >
          <p className="mb-4 text-sm">
            Vous pouvez conserver votre saisie en brouillon et la reprendre plus
            tard. Quitter sans enregistrer abandonne les modifications depuis la
            dernière sauvegarde.
          </p>
          {feedback?.error ? (
            <p
              role="alert"
              className="mb-3 rounded-lg bg-[#f8ded9] p-3 text-sm text-[#943f37]"
            >
              {feedback.message}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={propertyPrimaryButton}
              disabled={busy}
              onClick={() => {
                afterLeave.current = undefined;
                setDialog(null);
              }}
            >
              Continuer la saisie
            </button>
            <button
              type="button"
              className={propertySecondaryButton}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await saveDraft();
                  exitWizard();
                })
              }
            >
              {busy ? "Enregistrement…" : "Enregistrer le brouillon et quitter"}
            </button>
            <button
              type="button"
              className={propertySecondaryButton}
              disabled={busy}
              onClick={exitWizard}
            >
              Quitter sans enregistrer
            </button>
          </div>
        </CommercialDialog>
      ) : null}
    </section>
  );
}
