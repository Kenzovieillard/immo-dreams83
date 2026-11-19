"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ImagePlus } from "lucide-react";
import {
  formatPrice,
  propertyTypeLabels,
  type Property,
} from "@/data/properties";
import { BentoEmptyState } from "@/components/admin/bento/bento-states";
import {
  CommercialDialog,
  StatusBadge,
} from "@/components/commercial/commercial-design-ui";
import {
  CommercialBadge,
  CommercialPanel,
  commercialPrimaryButton,
  commercialSecondaryButton,
  fieldClass,
} from "@/components/commercial/commercial-ui";
import {
  propertyAvailability,
  propertyPublicationLabels,
  propertyMissingFields,
  type PropertyPerson,
  type PropertyRelations,
} from "@/lib/property-workspace";
import { cn } from "@/lib/utils";
import { PropertyDocuments } from "./property-documents";
import { PropertyPhoto, PropertyStatusBadge } from "./property-portfolio";
import { propertySecondaryButton } from "./property-ui";
import styles from "./property-layout.module.css";
import {
  PropertyAdditionalFields,
  PropertyField,
  PropertyPersonField,
  propertyRequest,
  schedulePropertyPublication,
  uploadPropertyPhoto,
} from "./property-wizard";
import {
  emptyPropertyDetails,
  parsePropertyNumber,
  propertyToDraft,
  propertyWorkspaceFields,
} from "@/lib/property-workspace";

const tabs = [
  "Aperçu",
  "Informations",
  "Médias",
  "Commercialisation",
  "Acquéreurs",
  "Visites",
  "Offres",
  "Documents",
  "Activités",
] as const;
type Tab = (typeof tabs)[number];
const shortDate = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "Europe/Paris",
});
const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});
const formatDate = (date: string | null | undefined) =>
  date ? shortDate.format(new Date(date)) : "—";
type PersistProperty = (property: Property) => Promise<boolean>;

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-[#59645f]">{label}</dt>
          <dd className="font-semibold [overflow-wrap:anywhere]">
            {value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DetailPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <CommercialPanel className="grid min-w-0 content-start gap-3 p-4 sm:p-5">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </CommercialPanel>
  );
}

function PropertyInternalEditor({
  property,
  owners,
  advisors,
  onPersist,
}: {
  property: Property;
  owners: PropertyPerson[];
  advisors: PropertyPerson[];
  onPersist: PersistProperty;
}) {
  const initial = propertyToDraft(property);
  const [fields, setFields] = useState({
    streetAddress: initial.streetAddress,
    latitude: initial.latitude,
    longitude: initial.longitude,
    ownerContactId: initial.ownerContactId,
    advisorId: initial.advisorId,
    workspaceDetails: initial.workspaceDetails,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const details = fields.workspaceDetails;
  async function save() {
    setError("");
    const parsed = propertyWorkspaceFields.safeParse(fields);
    const latitude = fields.latitude
      ? parsePropertyNumber(fields.latitude)
      : null;
    const longitude = fields.longitude
      ? parsePropertyNumber(fields.longitude)
      : null;
    if (
      !parsed.success ||
      ((latitude !== null || longitude !== null) &&
        !(
          latitude !== null &&
          longitude !== null &&
          Math.abs(latitude) <= 90 &&
          Math.abs(longitude) <= 180
        ))
    ) {
      setError("Vérifiez les coordonnées et utilisez des liens HTTPS.");
      return;
    }
    setBusy(true);
    try {
      await onPersist({
        ...property,
        latitude,
        longitude,
        streetAddress: fields.streetAddress || null,
        ownerContactId: fields.ownerContactId || null,
        advisorId: fields.advisorId || null,
        workspaceDetails: details,
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <DetailPanel title="Données internes, mandat prévu et liens">
      {error ? (
        <p role="alert" className="text-sm text-[#943f37]">
          {error}
        </p>
      ) : null}
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <PropertyPersonField
          value={fields.ownerContactId}
          options={owners}
          label="Propriétaire"
          onChange={(value) =>
            setFields((state) => ({ ...state, ownerContactId: value }))
          }
        />
        <PropertyPersonField
          value={fields.advisorId}
          options={advisors}
          label="Conseiller"
          onChange={(value) =>
            setFields((state) => ({ ...state, advisorId: value }))
          }
        />
        {(
          [
            ["streetAddress", "Adresse interne"],
            ["latitude", "Latitude"],
            ["longitude", "Longitude"],
          ] as const
        ).map(([key, label]) => (
          <PropertyField key={key} label={label}>
            <input
              className={fieldClass}
              value={fields[key]}
              onChange={(e) =>
                setFields((state) => ({ ...state, [key]: e.target.value }))
              }
            />
          </PropertyField>
        ))}
        {(
          [
            ["constructionYear", "Année de construction"],
            ["condition", "État général"],
            ["agencyFee", "Honoraires renseignés (€)"],
            ["videoUrl", "Lien vidéo HTTPS"],
            ["tourUrl", "Lien de visite virtuelle HTTPS"],
          ] as const
        ).map(([key, label]) => (
          <PropertyField key={key} label={label}>
            <input
              className={fieldClass}
              value={details[key]}
              onChange={(e) =>
                setFields((state) => ({
                  ...state,
                  workspaceDetails: {
                    ...state.workspaceDetails,
                    [key]: e.target.value,
                  },
                }))
              }
            />
          </PropertyField>
        ))}
        <PropertyField label="Type de mandat prévu">
          <select
            className={fieldClass}
            value={details.plannedMandateType}
            onChange={(e) =>
              setFields((state) => ({
                ...state,
                workspaceDetails: {
                  ...state.workspaceDetails,
                  plannedMandateType: e.target
                    .value as typeof details.plannedMandateType,
                },
              }))
            }
          >
            <option value="">Non renseigné</option>
            <option value="simple">Simple</option>
            <option value="exclusive">Exclusif</option>
            <option value="semi_exclusive">Semi-exclusif</option>
          </select>
        </PropertyField>
        {(["address", "structure", "diagnostics", "legal"] as const).map(
          (group) => (
            <PropertyAdditionalFields
              key={group}
              group={group}
              value={details}
              onChange={(value) =>
                setFields((state) => ({ ...state, workspaceDetails: value }))
              }
            />
          ),
        )}
        <button
          className={commercialPrimaryButton}
          type="submit"
          disabled={busy}
        >
          {busy ? "Enregistrement…" : "Enregistrer les données internes"}
        </button>
      </form>
    </DetailPanel>
  );
}

function PropertyMedia({
  property,
  canWrite,
  onPersist,
  onPhoto,
}: {
  property: Property;
  canWrite: boolean;
  onPersist: PersistProperty;
  onPhoto: (index: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);
  async function updatePhotos(photos: string[]) {
    setBusy(true);
    try {
      await onPersist({ ...property, photos });
    } finally {
      setBusy(false);
    }
  }
  async function addPhoto() {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const url = uploaded ?? (await uploadPropertyPhoto(file));
      setUploaded(url);
      if (await onPersist({ ...property, photos: [...property.photos, url] })) {
        setFile(null);
        setUploaded(null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, shift: number) {
    const next = [...property.photos];
    [next[index], next[index + shift]] = [next[index + shift], next[index]];
    void updatePhotos(next);
  }

  return (
    <div className="grid gap-4">
      <DetailPanel title={`Galerie photos (${property.photos.length})`}>
        {canWrite && property.photos.length < 12 ? (
          <div className="flex flex-wrap items-end gap-3">
            <PropertyField label="Sélectionner une photo (4 Mio maximum)">
              <input
                type="file"
                className={fieldClass}
                disabled={busy}
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  e.target.value = "";
                  if (!chosen) return;
                  if (chosen.size > 4 * 1024 * 1024) {
                    setError("Cette photo dépasse 4 Mio.");
                    return;
                  }
                  setFile(chosen);
                  setUploaded(null);
                  setError("");
                }}
              />
            </PropertyField>
            <button
              type="button"
              onClick={() => void addPhoto()}
              className={commercialPrimaryButton}
              disabled={busy || !file}
            >
              <ImagePlus aria-hidden="true" className="size-4" />
              Ajouter la photo
            </button>
            {file ? <span className="text-sm">{file.name}</span> : null}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-[#943f37]">
            {error}
          </p>
        ) : null}
        {!property.photos.length ? (
          <BentoEmptyState
            title="Aucune photo"
            description="La première photo enregistrée devient la photo principale."
          />
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {property.photos.map((url, index) => (
            <div key={`${url}-${index}`} className="grid gap-2">
              <button
                type="button"
                className="relative aspect-[4/3] overflow-hidden rounded-lg"
                onClick={() => onPhoto(index)}
                aria-label={`Agrandir la photo ${index + 1}`}
              >
                <Image
                  src={url}
                  alt={`${property.title}, photo ${index + 1}`}
                  fill
                  sizes="(min-width: 1280px) 20vw, 50vw"
                  className="object-cover"
                />
                {index === 0 ? (
                  <span className="absolute bottom-2 left-2 rounded bg-[#17221e] px-2 py-1 text-xs text-white">
                    Principale
                  </span>
                ) : null}
              </button>
              {canWrite ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    className={cn(commercialSecondaryButton, "px-2")}
                    aria-label={`Monter la photo ${index + 1}`}
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    className={cn(commercialSecondaryButton, "px-2")}
                    aria-label={`Descendre la photo ${index + 1}`}
                    disabled={busy || index === property.photos.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="px-1 text-xs underline"
                    onClick={() => {
                      if (window.confirm("Retirer cette photo de la galerie ?"))
                        void updatePhotos(
                          property.photos.filter((_, i) => i !== index),
                        );
                    }}
                  >
                    Retirer
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </DetailPanel>
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["Vidéo de présentation", property.workspaceDetails?.videoUrl],
            ["Visite virtuelle", property.workspaceDetails?.tourUrl],
          ] as const
        ).map(([title, url]) => (
          <DetailPanel key={title} title={title}>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline"
              >
                Ouvrir le lien
              </a>
            ) : (
              <p className="text-sm text-[#59645f]">Aucun lien associé.</p>
            )}
          </DetailPanel>
        ))}
      </div>
    </div>
  );
}

export function PropertyDetail({
  property,
  owners,
  advisors,
  canWrite,
  canCreateOffer,
  visibleOnHome,
  onBack,
  onManage,
  onPersist,
  onScheduleUpdate,
  editor,
}: {
  property: Property;
  owners: PropertyPerson[];
  advisors: PropertyPerson[];
  canWrite: boolean;
  canCreateOffer: boolean;
  visibleOnHome: boolean;
  onBack: () => void;
  onManage: () => void;
  onPersist: PersistProperty;
  onScheduleUpdate: (property: Property) => void;
  editor: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("Aperçu");
  const heading = useRef<HTMLHeadingElement>(null);
  const [editing, setEditing] = useState(false);
  const [photo, setPhoto] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [relations, setRelations] = useState<PropertyRelations | null>(null);
  const [error, setError] = useState("");
  const [scheduledInput, setScheduledInput] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const missing = propertyMissingFields(property);
  const details = property.workspaceDetails ?? emptyPropertyDetails;
  const propertyId = property.id;
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const payload = await propertyRequest<{ relations: PropertyRelations }>(
          `/api/admin/properties/${encodeURIComponent(propertyId)}`,
          { signal },
        );
        if (!signal?.aborted) {
          setRelations(payload.relations);
          setError("");
        }
      } catch (error) {
        if (!signal?.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Les données liées sont indisponibles.",
          );
      }
    },
    [propertyId],
  );
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load, property.updatedAt]);

  async function updateSchedule(value: string | null) {
    setScheduleError("");
    setBusy(true);
    try {
      onScheduleUpdate(await schedulePropertyPublication(property, value));
      setScheduledInput("");
    } catch (error) {
      setScheduleError(
        error instanceof Error ? error.message : "Programmation impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  const metadata: [string, ReactNode][] = [
    [
      "Conseiller",
      relations?.advisor?.name ??
        advisors.find((item) => item.id === property.advisorId)?.name ??
        "Non attribué",
    ],
    [
      "Propriétaire",
      relations?.owner ? (
        <Link
          className="underline"
          href={`/admin?tab=contacts&contact=${relations.owner.id}`}
        >
          {relations.owner.name}
        </Link>
      ) : (
        "Non renseigné"
      ),
    ],
    [
      "Type / prix",
      `${propertyTypeLabels[property.type]} · ${formatPrice(property.price)}`,
    ],
    ["Surface", `${property.surface} m²`],
    [
      "Terrain",
      property.landSurface != null ? `${property.landSurface} m²` : "—",
    ],
    ["Secteur", `${property.city} (${property.postalCode})`],
    ["Réf. mandat", property.mandateNumber || "—"],
    ["Dernière modification", formatDate(property.updatedAt)],
  ];
  const characteristics: [string, ReactNode][] = [
    ["Pièces", property.rooms],
    ["Chambres", property.bedrooms],
    ["Salles de bains", property.bathrooms],
    ["Année de construction", details.constructionYear || "—"],
    ["État général", details.condition || "—"],
    ["DPE", property.energyClass || "—"],
    ["GES", property.climateClass || "—"],
    ["Adresse interne", property.streetAddress || "Non renseignée"],
    ["Quartier", details.district || "—"],
    ["Étage", details.floor || "—"],
    ["Chauffage", details.heating || "—"],
    ["Exposition", details.exposure || "—"],
    ["Date des diagnostics", formatDate(details.diagnosticsDate)],
    ["Diagnostiqueur", details.diagnostician || "—"],
  ];

  const history = property.history?.length
    ? property.history.map((item) => ({
        id: item.id,
        kind: item.changedFields.includes("photos") ? "media" : "property",
        at: item.createdAt,
        who: item.actorEmail,
        label:
          item.action === "property.create"
            ? "Création du bien"
            : item.action === "property.publication.scheduled"
              ? "Publication programmée exécutée"
              : item.action === "property.publication.blocked"
                ? "Publication programmée bloquée"
                : item.changedFields.includes("photos")
                  ? "Galerie modifiée"
                  : item.changedFields.includes("publication_status")
                    ? "État de publication modifié"
                    : "Modification du bien",
        href: "",
      }))
    : (relations?.activities ?? []).map((item) => ({
        id: item.id,
        kind: "property",
        at: item.createdAt,
        who: item.author,
        label: item.action,
        href: "",
      }));
  const timeline = [
    ...history,
    ...(relations?.visits ?? []).map((visit) => ({
      id: visit.id,
      kind: "visit",
      at: visit.startsAt,
      who: null,
      label: visit.title,
      href: `/commercial/visites/${visit.id}`,
    })),
    ...(relations?.offers ?? []).map((offer) => ({
      id: offer.id,
      kind: "offer",
      at: offer.createdAt,
      who: null,
      label:
        offer.amount == null
          ? "Offre enregistrée"
          : `Offre · ${formatPrice(offer.amount)}`,
      href: `/commercial/offres/${offer.id}`,
    })),
  ]
    .filter((item) => activityFilter === "all" || activityFilter === item.kind)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const mandates = (
    <DetailPanel title="Mandats et honoraires">
      {relations?.mandates.length ? (
        relations.mandates.map((mandate) => (
          <dl
            className="grid gap-2 border-b border-[#dfddd4] pb-2 text-sm last:border-0"
            key={mandate.id}
          >
            <div>
              <dt className="text-xs text-[#59645f]">Mandat</dt>
              <dd>
                {mandate.reference} · {mandate.type} · {mandate.status}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#59645f]">Signature / échéance</dt>
              <dd>
                {formatDate(mandate.signedAt)} / {formatDate(mandate.expiresAt)}
              </dd>
            </div>
          </dl>
        ))
      ) : (
        <p className="text-sm text-[#59645f]">
          {relations
            ? "Aucun mandat contractuel lié."
            : "Données du mandat en cours de lecture."}
        </p>
      )}
      <Facts
        items={[
          ["Type prévu", details.plannedMandateType || "—"],
          [
            "Honoraires renseignés",
            details.agencyFee ? `${details.agencyFee} €` : "—",
          ],
        ]}
      />
    </DetailPanel>
  );

  return (
    <section
      aria-label="Fiche bien"
      className="grid min-w-0 gap-5 text-[#18211f]"
    >
      <div>
        <button
          type="button"
          className={propertySecondaryButton}
          onClick={onBack}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour aux biens
        </button>
      </div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h2
            ref={heading}
            tabIndex={-1}
            className="text-2xl font-bold [overflow-wrap:anywhere]"
          >
            {property.title}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <button
              type="button"
              className={commercialSecondaryButton}
              onClick={() => {
                setEditing((state) => !state);
                setTab("Informations");
              }}
            >
              {editing ? "Fermer l’édition" : "Modifier"}
            </button>
          ) : null}
          <button
            type="button"
            className={propertySecondaryButton}
            onClick={onManage}
            aria-haspopup="dialog"
          >
            Actions du bien
          </button>
        </div>
      </header>
      <Facts
        items={[
          ["Disponibilité", propertyAvailability[property.status]],
          [
            "Publication",
            propertyPublicationLabels[property.publicationStatus ?? "DRAFT"],
          ],
          ["Mise à la une", visibleOnHome ? "À la une" : "Absente"],
        ]}
      />
      {tab === "Aperçu" && property.photos.length ? (
        <button
          type="button"
          className="relative overflow-hidden rounded-xl text-left"
          onClick={() => setPhoto(0)}
          aria-label="Agrandir la photo principale"
        >
          <PropertyPhoto property={property} className={styles.detailCover} />
          <span className="absolute bottom-3 left-3 rounded-lg bg-[#17221e]/90 px-3 py-2 text-sm text-white">
            {property.city} · {formatPrice(property.price)}
          </span>
        </button>
      ) : null}
      <CommercialPanel className="p-4">
        <Facts items={metadata} />
      </CommercialPanel>
      <nav
        aria-label="Rubriques du bien"
        className="flex flex-wrap gap-1 border-b border-[#dfddd4] pb-2"
      >
        {tabs.map((item) => (
          <button
            type="button"
            aria-pressed={tab === item}
            key={item}
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              tab === item && "bg-[#2f493a] font-semibold text-white",
            )}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      {error ? (
        <p role="alert" className="flex flex-wrap gap-2 text-sm text-[#943f37]">
          {error}
          <button
            type="button"
            className="underline"
            onClick={() => void load()}
          >
            Réessayer
          </button>
        </p>
      ) : null}
      {!relations && !error ? (
        <p role="status" className="text-sm text-[#59645f]">
          Chargement des données liées…
        </p>
      ) : null}
      {tab === "Aperçu" ? (
        <div className={cn("grid gap-4", styles.overviewColumns)}>
          <div className="grid content-start gap-4">
            <DetailPanel title="Galerie">
              {property.photos.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {property.photos.slice(0, 4).map((url, index) => (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      aria-label={`Agrandir la photo ${index + 1}`}
                      className="relative aspect-[4/3] overflow-hidden rounded-lg"
                      onClick={() => setPhoto(index)}
                    >
                      <Image
                        src={url}
                        alt=""
                        fill
                        sizes="200px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm">Aucune photo principale.</p>
              )}
              <button
                type="button"
                className="w-fit text-sm underline"
                onClick={() => setTab("Médias")}
              >
                Ouvrir la galerie
              </button>
            </DetailPanel>
            <DetailPanel title="Caractéristiques principales">
              <Facts items={characteristics} />
            </DetailPanel>
            <DetailPanel title="Description">
              <p className="whitespace-pre-wrap text-sm">
                {property.descriptionLong ||
                  property.descriptionShort ||
                  "Non renseignée"}
              </p>
            </DetailPanel>
          </div>
          <div className="grid content-start gap-4">
            <DetailPanel title="Suivi commercial">
              <Facts
                items={[
                  ["Visites", relations?.visits.length],
                  ["Offres", relations?.offers.length],
                  ["Acquéreurs compatibles", relations?.buyers.length],
                ]}
              />
            </DetailPanel>
            {missing.length ? (
              <DetailPanel title="À compléter">
                <div className="flex flex-wrap gap-2">
                  {missing.map((item) => (
                    <CommercialBadge key={item} tone="warning">
                      {item}
                    </CommercialBadge>
                  ))}
                </div>
              </DetailPanel>
            ) : null}
            {mandates}
          </div>
        </div>
      ) : null}
      {editing && canWrite ? (
        <div hidden={tab !== "Informations"}>
          <div className="grid gap-4">
            {editor}
            <PropertyInternalEditor
              key={property.updatedAt}
              property={property}
              owners={owners}
              advisors={advisors}
              onPersist={onPersist}
            />
          </div>
        </div>
      ) : null}
      {tab === "Informations" ? (
        <div className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <DetailPanel title="Caractéristiques">
              <Facts items={characteristics} />
            </DetailPanel>
            <DetailPanel title="Équipements et prestations">
              {property.features.length ? (
                <div className="flex flex-wrap gap-2">
                  {property.features.map((feature) => (
                    <CommercialBadge key={feature} dot={false}>
                      {feature}
                    </CommercialBadge>
                  ))}
                </div>
              ) : (
                <p className="text-sm">Non renseignés.</p>
              )}
            </DetailPanel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <DetailPanel title="Informations légales et financières">
              <Facts
                items={[
                  [
                    "Copropriété",
                    details.condo === "yes"
                      ? "Oui"
                      : details.condo === "no"
                        ? "Non"
                        : "—",
                  ],
                  [
                    "Taxe foncière annuelle",
                    details.propertyTax
                      ? formatPrice(parsePropertyNumber(details.propertyTax))
                      : "—",
                  ],
                  [
                    "Charges annuelles",
                    details.condoFees
                      ? formatPrice(parsePropertyNumber(details.condoFees))
                      : "—",
                  ],
                  [
                    "Procédure en cours",
                    details.pendingProceeding === "yes"
                      ? "Oui"
                      : details.pendingProceeding === "no"
                        ? "Non"
                        : "—",
                  ],
                ]}
              />
            </DetailPanel>
            <DetailPanel title="Détail des pièces">
              {details.roomDetails.length ? (
                <Facts
                  items={details.roomDetails.map((room, index) => [
                    room.label || `Pièce ${index + 1}`,
                    room.surface ? `${room.surface} m²` : "—",
                  ])}
                />
              ) : (
                <p className="text-sm">Non renseigné.</p>
              )}
            </DetailPanel>
          </div>
          <DetailPanel title="Description longue">
            <p className="whitespace-pre-wrap text-sm">
              {property.descriptionLong || "Non renseignée"}
            </p>
          </DetailPanel>
        </div>
      ) : null}
      {tab === "Médias" ? (
        <PropertyMedia
          property={property}
          canWrite={canWrite}
          onPersist={onPersist}
          onPhoto={setPhoto}
        />
      ) : null}
      {tab === "Commercialisation" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <DetailPanel title="Diffusion">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <strong>Site IMMO DREAMS</strong>
              <PropertyStatusBadge property={property} />
            </div>
            <p className="text-sm">
              Date de publication · {formatDate(property.publishedAt)}
            </p>
            {property.publicationStatus === "PUBLISHED" &&
            property.status !== "sold" ? (
              <Link
                href={`/biens/${encodeURIComponent(property.slug)}`}
                className="text-sm underline"
              >
                Voir l’annonce publique
              </Link>
            ) : null}
            {property.scheduledPublicationAt ? (
              <p role="status" className="text-sm">
                Publication programmée ·{" "}
                {dateTime.format(new Date(property.scheduledPublicationAt))}{" "}
                (Paris)
              </p>
            ) : null}
            {property.publicationScheduleError || scheduleError ? (
              <p role="alert" className="text-sm text-[#943f37]">
                {scheduleError || property.publicationScheduleError}
              </p>
            ) : null}
            {canWrite &&
            ["DRAFT", "UNPUBLISHED"].includes(
              property.publicationStatus ?? "DRAFT",
            ) &&
            property.status !== "sold" ? (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void updateSchedule(scheduledInput);
                }}
              >
                <PropertyField label="Date et heure de publication (heure locale)">
                  <input
                    type="datetime-local"
                    className={cn(fieldClass, "w-full")}
                    value={scheduledInput}
                    onChange={(event) => setScheduledInput(event.target.value)}
                    required
                  />
                </PropertyField>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className={commercialPrimaryButton}
                    disabled={busy || !scheduledInput}
                  >
                    {property.scheduledPublicationAt
                      ? "Modifier la programmation"
                      : "Programmer la publication"}
                  </button>
                  {property.scheduledPublicationAt ? (
                    <button
                      type="button"
                      className={commercialSecondaryButton}
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("Annuler cette programmation ?"))
                          void updateSchedule(null);
                      }}
                    >
                      Annuler la programmation
                    </button>
                  ) : null}
                </div>
              </form>
            ) : null}
            <p className="text-sm text-[#59645f]">
              Les portails externes nécessitent une connexion.
            </p>
          </DetailPanel>
          {mandates}
        </div>
      ) : null}
      {tab === "Acquéreurs" && relations ? (
        <DetailPanel title="Acquéreurs compatibles">
          <p className="text-sm text-[#59645f]">
            Correspondance avec tous les critères renseignés dans chaque
            recherche active.
          </p>
          {relations.buyers.length ? (
            relations.buyers.map((buyer) => (
              <div
                key={buyer.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dfddd4] py-2 text-sm last:border-0"
              >
                <Link
                  href={`/admin?tab=contacts&contact=${buyer.id}`}
                  className="font-semibold underline"
                >
                  {buyer.name}
                </Link>
                <span>
                  {buyer.budget != null
                    ? formatPrice(buyer.budget)
                    : "Budget non renseigné"}
                </span>
                <span>{buyer.criteria.join(" · ")}</span>
                <Link
                  href={`/admin?tab=contacts&contact=${buyer.id}`}
                  className={commercialSecondaryButton}
                >
                  Ouvrir le contact
                </Link>
              </div>
            ))
          ) : (
            <BentoEmptyState
              title="Aucune recherche compatible"
              description="Les critères renseignés des acquéreurs accessibles sont utilisés pour ce rapprochement."
            />
          )}
        </DetailPanel>
      ) : null}
      {tab === "Visites" && relations ? (
        <DetailPanel title="Visites liées au bien">
          {canWrite ? (
            <Link
              className={cn(commercialPrimaryButton, "w-fit")}
              href={`/commercial/visites/nouvelle?bien_id=${property.id}`}
            >
              Planifier une visite
            </Link>
          ) : null}
          {relations.visits.length ? (
            relations.visits.map((visit) => (
              <div
                key={visit.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfddd4] py-2 text-sm last:border-0"
              >
                <Link
                  className="font-semibold underline"
                  href={`/commercial/visites/${visit.id}`}
                >
                  {visit.title}
                </Link>
                <span>{dateTime.format(new Date(visit.startsAt))}</span>
                <StatusBadge status={visit.status} />
                {visit.interest != null ? (
                  <span>Intérêt {visit.interest}/5</span>
                ) : null}
                {visit.reportSubmittedAt ? (
                  <Link
                    className="underline"
                    href={`/commercial/visites/${visit.id}#compte-rendu`}
                  >
                    Voir le compte rendu
                  </Link>
                ) : null}
              </div>
            ))
          ) : (
            <BentoEmptyState title="Aucune visite associée" />
          )}
        </DetailPanel>
      ) : null}
      {tab === "Offres" && relations ? (
        <DetailPanel title="Offres liées au bien">
          {canCreateOffer &&
          property.status !== "sold" &&
          property.publicationStatus !== "ARCHIVED" ? (
            <Link
              className={cn(commercialPrimaryButton, "w-fit")}
              href={`/commercial/offres/nouvelle?bien_id=${property.id}`}
            >
              Nouvelle offre
            </Link>
          ) : null}
          {relations.offers.length ? (
            relations.offers.map((offer) => (
              <div
                key={offer.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfddd4] py-2 text-sm last:border-0"
              >
                <Link
                  className="font-semibold underline"
                  href={`/commercial/offres/${offer.id}`}
                >
                  {offer.amount === null
                    ? "Montant non renseigné"
                    : formatPrice(offer.amount)}
                </Link>
                <StatusBadge status={offer.status} />
                <span>{formatDate(offer.createdAt)}</span>
              </div>
            ))
          ) : (
            <BentoEmptyState title="Aucune offre associée" />
          )}
        </DetailPanel>
      ) : null}
      {tab === "Documents" ? (
        <PropertyDocuments propertyId={property.id} canWrite={canWrite} />
      ) : null}
      {tab === "Activités" ? (
        <DetailPanel title="Historique du bien">
          <PropertyField label="Type d’activité">
            <select
              className={cn(fieldClass, "w-fit")}
              value={activityFilter}
              onChange={(event) => setActivityFilter(event.target.value)}
            >
              <option value="all">Toutes</option>
              <option value="property">Fiche et publication</option>
              <option value="media">Photos</option>
              <option value="visit">Visites</option>
              <option value="offer">Offres</option>
            </select>
          </PropertyField>
          {timeline.length ? (
            timeline.map((item) => (
              <div
                key={item.id}
                className="grid gap-1 border-b border-[#dfddd4] py-2 text-sm last:border-0"
              >
                {item.href ? (
                  <Link href={item.href} className="font-semibold underline">
                    {item.label}
                  </Link>
                ) : (
                  <strong>{item.label}</strong>
                )}
                <p>
                  {dateTime.format(new Date(item.at))}
                  {item.who ? " · " + item.who : ""}
                </p>
              </div>
            ))
          ) : relations ? (
            <BentoEmptyState title="Aucune activité pour ce filtre" />
          ) : null}
        </DetailPanel>
      ) : null}
      <footer className="flex flex-wrap gap-2 border-t border-[#dfddd4] pt-4">
        <button
          type="button"
          className={propertySecondaryButton}
          onClick={onBack}
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Retour aux biens
        </button>
        <button
          type="button"
          className={propertySecondaryButton}
          onClick={() => heading.current?.focus()}
        >
          <ArrowUp className="size-4" aria-hidden="true" /> Haut de la fiche
        </button>
      </footer>
      {photo !== null && property.photos[photo] ? (
        <CommercialDialog
          title={`Photo ${photo + 1} sur ${property.photos.length}`}
          onClose={() => setPhoto(null)}
        >
          <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[#17221e]">
            <Image
              alt={property.title}
              fill
              src={property.photos[photo]}
              sizes="90vw"
              className="object-contain"
            />
          </div>
          <div className="mt-3 flex justify-between gap-2">
            <button
              type="button"
              className={commercialSecondaryButton}
              disabled={photo === 0}
              onClick={() => setPhoto(photo - 1)}
            >
              Précédente
            </button>
            <button
              type="button"
              className={commercialSecondaryButton}
              disabled={photo === property.photos.length - 1}
              onClick={() => setPhoto(photo + 1)}
            >
              Suivante
            </button>
          </div>
        </CommercialDialog>
      ) : null}
    </section>
  );
}
