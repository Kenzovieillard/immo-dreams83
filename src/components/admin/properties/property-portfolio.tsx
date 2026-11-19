"use client";

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  ChevronDown,
  Download,
  Grid2X2,
  List,
  Map as MapIcon,
  Plus,
  Search,
  Table2,
} from "lucide-react";
import {
  formatPrice,
  propertyPublicationStatusLabels,
  propertyStatusLabels,
  propertyTypeLabels,
  type Property,
  type PropertyType,
} from "@/data/properties";
import { getPropertyDpePosition } from "@/lib/dpe";
import {
  parsePropertyNumber,
  propertyKinds,
  propertyMissingFields,
  propertySearchMatches,
  type PropertyPerson,
} from "@/lib/property-workspace";
import { cn } from "@/lib/utils";
import { BentoEmptyState } from "@/components/admin/bento/bento-states";
import {
  CommercialBadge,
  CommercialPanel,
  commercialPrimaryButton,
  commercialSecondaryButton,
  fieldClass,
} from "@/components/commercial/commercial-ui";
import { CommercialDialog } from "@/components/commercial/commercial-design-ui";
import { isMapPostalCode } from "@/lib/property-communes";
import { PropertyCommuneView } from "./property-commune-view";
import { propertySecondaryButton } from "./property-ui";
import styles from "./property-layout.module.css";

const pageSize = 12;
const tabs = [
  { key: "all", label: "Tous", includes: () => true },
  {
    key: "active",
    label: "Actifs",
    includes: (p: Property) =>
      p.status !== "sold" && p.publicationStatus !== "ARCHIVED",
  },
  {
    key: "incomplete",
    label: "À compléter",
    includes: (p: Property) =>
      p.publicationStatus !== "ARCHIVED" && propertyMissingFields(p).length > 0,
  },
  {
    key: "published",
    label: "Publiés",
    includes: (p: Property) =>
      p.publicationStatus === "PUBLISHED" && p.status !== "sold",
  },
  {
    key: "under-offer",
    label: "Sous offre",
    includes: (p: Property) =>
      p.status === "under_offer" && p.publicationStatus !== "ARCHIVED",
  },
  {
    key: "sold",
    label: "Vendus",
    includes: (p: Property) => p.status === "sold",
  },
  {
    key: "archived",
    label: "Archivés",
    includes: (p: Property) => p.publicationStatus === "ARCHIVED",
  },
] as const;
const views = [
  { key: "gallery", label: "Galerie", icon: Grid2X2 },
  { key: "table", label: "Tableau", icon: Table2 },
  { key: "map", label: "Carte", icon: MapIcon },
  { key: "compact", label: "Liste compacte", icon: List },
] as const;
const sortChoices = [
  { key: "reference", label: "Référence" },
  { key: "title", label: "Bien" },
  { key: "type", label: "Type" },
  { key: "surface", label: "Surface" },
  { key: "price", label: "Prix" },
  { key: "advisorId", label: "Conseiller" },
  { key: "status", label: "Statut" },
  { key: "updatedAt", label: "Dernière modification" },
] as const;
type SortKey = (typeof sortChoices)[number]["key"];
type View = (typeof views)[number]["key"];
type Range = { min: string; max: string };
const emptyRange: Range = { min: "", max: "" };

function validRange(range: Range) {
  const lower = range.min ? parsePropertyNumber(range.min) : 0;
  const upper = range.max ? parsePropertyNumber(range.max) : Infinity;
  return lower >= 0 && upper >= lower;
}

function inRange(value: number, range: Range) {
  return (
    (!range.min || value >= parsePropertyNumber(range.min)) &&
    (!range.max || value <= parsePropertyNumber(range.max))
  );
}

function Filter({
  children,
  label,
  active,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <details
      className="min-w-0 rounded-lg border border-[#dfddd4] bg-[#fbfaf7]"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        className={cn(
          "flex min-h-9 cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium",
          active && "bg-[#dce5d7]",
        )}
      >
        {label}
        <ChevronDown aria-hidden="true" className="size-3" />
      </summary>
      <div className="grid max-h-56 gap-2 overflow-auto p-3 text-sm">
        {children}
      </div>
    </details>
  );
}

function RangeFields({
  value,
  onChange,
  unit,
}: {
  value: Range;
  onChange: (range: Range) => void;
  unit: string;
}) {
  return (
    <>
      {(["min", "max"] as const).map((key) => (
        <label key={key} className="grid gap-1 text-xs">
          {key === "min" ? "Minimum" : "Maximum"} ({unit})
          <input
            className={cn(fieldClass, "w-full")}
            inputMode="decimal"
            value={value[key]}
            onChange={(event) =>
              onChange({ ...value, [key]: event.target.value })
            }
            aria-invalid={!validRange(value)}
          />
        </label>
      ))}
      {!validRange(value) ? (
        <p role="alert" className="text-xs text-[#a33a30]">
          Vérifiez la fourchette. Le minimum doit être inférieur ou égal au
          maximum.
        </p>
      ) : null}
    </>
  );
}

export function PropertyPhoto({
  property,
  className,
}: {
  property: Property;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden bg-[#e5e9df] text-[#596b61]",
        className,
      )}
    >
      {property.photos[0] ? (
        <Image
          src={property.photos[0]}
          alt=""
          fill
          sizes="(min-width: 1024px) 70vw, 100vw"
          className="object-cover"
        />
      ) : (
        <span className="flex items-center gap-2 p-2 text-xs">
          <Building2 aria-hidden="true" className="size-5" />
          <span className="sr-only">Photo manquante</span>
        </span>
      )}
    </div>
  );
}

export function PropertyStatusBadge({ property }: { property: Property }) {
  const publication = property.publicationStatus;
  if (publication === "ARCHIVED")
    return <CommercialBadge>Archivé</CommercialBadge>;
  if (property.status !== "available")
    return (
      <CommercialBadge
        tone={property.status === "sold" ? "neutral" : "warning"}
      >
        {propertyStatusLabels[property.status]}
      </CommercialBadge>
    );
  if (publication === "PUBLISHED")
    return <CommercialBadge tone="success">Publié</CommercialBadge>;
  if (propertyMissingFields(property).length)
    return <CommercialBadge tone="warning">À compléter</CommercialBadge>;
  return (
    <CommercialBadge>
      {publication === "UNPUBLISHED" ? "Dépublié" : "Brouillon"}
    </CommercialBadge>
  );
}

function spreadsheetCell(value: string | number) {
  const text = String(value);
  const safe =
    typeof value === "string" && /^[\s\uFEFF]*[=+@-]/.test(text)
      ? "'" + text
      : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function exportProperties(properties: Property[]) {
  const headings = [
    "Référence",
    "Titre",
    "Type",
    "Commune",
    "Code postal",
    "Surface (m²)",
    "Prix (€)",
    "Statut commercial",
    "Publication",
  ];
  const rows = properties.map((p) => [
    p.reference,
    p.title,
    propertyTypeLabels[p.type],
    p.city,
    p.postalCode,
    p.surface,
    p.price,
    propertyStatusLabels[p.status],
    propertyPublicationStatusLabels[p.publicationStatus ?? "DRAFT"],
  ]);
  const csv = [headings, ...rows]
    .map((row) => row.map(spreadsheetCell).join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "portefeuille-biens.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PropertyPortfolio({
  properties,
  advisors,
  canWrite,
  onCreate,
  onOpen,
  onManage,
  draftActions,
}: {
  properties: Property[];
  advisors: PropertyPerson[];
  canWrite: boolean;
  onCreate: () => void;
  onOpen: (property: Property) => void;
  onManage: (property: Property) => void;
  draftActions?: ReactNode;
}) {
  const [view, setView] = useState<View>("gallery");
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [types, setTypes] = useState<PropertyType[]>([]);
  const [city, setCity] = useState("");
  const [advisor, setAdvisor] = useState("");
  const [price, setPrice] = useState(emptyRange);
  const [surface, setSurface] = useState(emptyRange);
  const [withoutPhoto, setWithoutPhoto] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [dpe, setDpe] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({
    key: "updatedAt",
    ascending: false,
  });
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);

  const advisorNames = useMemo(
    () => new Map(advisors.map(({ id, name }) => [id, name])),
    [advisors],
  );
  const cities = useMemo(
    () =>
      Array.from(new Set(properties.map((p) => p.city).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "fr"),
      ),
    [properties],
  );
  const eligible = useMemo(
    () =>
      properties.filter(
        (p) =>
          propertySearchMatches(p, search) &&
          (!types.length || types.includes(p.type)) &&
          (!city || p.city === city) &&
          (!advisor || (p.advisorId ?? "unassigned") === advisor) &&
          (!validRange(price) || inRange(p.price, price)) &&
          (!validRange(surface) || inRange(p.surface, surface)) &&
          (!withoutPhoto || !p.photos.length) &&
          (!featured || p.featured) &&
          (!dpe ||
            getPropertyDpePosition(p.energyClass, p.climateClass)?.letter ===
              dpe),
      ),
    [
      properties,
      search,
      types,
      city,
      advisor,
      price,
      surface,
      withoutPhoto,
      featured,
      dpe,
    ],
  );
  const filtered = useMemo(
    () =>
      eligible
        .filter(tabs.find((item) => item.key === tab)!.includes)
        .sort((a, b) => {
          const left =
            sort.key === "advisorId"
              ? advisorNames.get(a.advisorId ?? "")
              : a[sort.key];
          const right =
            sort.key === "advisorId"
              ? advisorNames.get(b.advisorId ?? "")
              : b[sort.key];
          const comparison =
            typeof left === "number" && typeof right === "number"
              ? left - right
              : String(left ?? "").localeCompare(String(right ?? ""), "fr", {
                  numeric: true,
                  sensitivity: "base",
                });
          return (
            (sort.ascending ? comparison : -comparison) ||
            a.id.localeCompare(b.id)
          );
        }),
    [eligible, tab, sort, advisorNames],
  );
  const postalCodes = useMemo(
    () =>
      Array.from(
        new Set(
          properties
            .map((property) => property.postalCode)
            .filter(isMapPostalCode),
        ),
      ).sort(),
    [properties],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(page, pageCount);
  const rows = filtered.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );
  const selected = filtered.filter((p) => selection.has(p.id));
  const selectedCount = rows.filter((p) => selection.has(p.id)).length;
  const missingPhotoCount = properties.filter(
    (p) => p.publicationStatus !== "ARCHIVED" && !p.photos.length,
  ).length;
  const filterActive = Boolean(
    search ||
      types.length ||
      city ||
      advisor ||
      price.min ||
      price.max ||
      surface.min ||
      surface.max ||
      withoutPhoto ||
      featured ||
      dpe,
  );

  function resetFilters() {
    setSearch("");
    setTypes([]);
    setCity("");
    setAdvisor("");
    setPrice(emptyRange);
    setSurface(emptyRange);
    setWithoutPhoto(false);
    setFeatured(false);
    setDpe("");
    setPage(1);
  }

  function selectSort(key: SortKey) {
    setSort((current) => ({
      key,
      ascending:
        current.key === key
          ? !current.ascending
          : !["updatedAt", "price", "surface"].includes(key),
    }));
    setPage(1);
  }

  function toggleSelected(ids: string[], checked: boolean) {
    setSelection((current) => {
      const next = new Set(current);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  function actions(property: Property) {
    return (
      <button
        type="button"
        className={propertySecondaryButton}
        aria-label={`Gérer ${property.title}`}
        aria-haspopup="dialog"
        onClick={() => onManage(property)}
      >
        Gérer
      </button>
    );
  }

  const openTitle = (p: Property) => (
    <button
      type="button"
      onClick={() => onOpen(p)}
      className="min-w-0 text-left font-semibold [overflow-wrap:anywhere] hover:underline"
    >
      {p.title}
    </button>
  );

  function compactRow(p: Property) {
    return (
      <div
        key={p.id}
        className="flex min-w-0 flex-wrap items-center gap-3 border-b border-[#dfddd4] px-2 py-3 last:border-0"
      >
        <PropertyPhoto property={p} className="size-12 shrink-0 rounded-md" />
        <div className="grid min-w-32 flex-1 text-sm">
          {openTitle(p)}
          <span className="text-xs text-[#59645f]">
            {p.city} {p.postalCode} · {p.surface} m²
            {p.rooms ? ` · ${p.rooms} p.` : ""}
          </span>
        </div>
        <span className="text-sm font-semibold">{formatPrice(p.price)}</span>
        <PropertyStatusBadge property={p} />
        {actions(p)}
      </div>
    );
  }

  return (
    <section
      aria-label="Portefeuille immobilier"
      className="grid min-w-0 grid-cols-1 gap-5 text-[#18211f]"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Biens</h2>
          <p className="text-sm text-[#59645f]">
            {properties.filter(tabs[1].includes).length} biens actifs dans le
            portefeuille
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {draftActions}
          <button
            type="button"
            className={commercialSecondaryButton}
            disabled={!filtered.length}
            onClick={() => setExportOpen(true)}
          >
            <Download aria-hidden="true" className="size-4" />
            Exporter
          </button>
          {canWrite ? (
            <button
              type="button"
              className={commercialPrimaryButton}
              onClick={onCreate}
            >
              <Plus aria-hidden="true" className="size-4" />
              Ajouter un bien
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex flex-wrap justify-between gap-3 border-b border-[#dfddd4] pb-4">
        <div
          aria-label="Statut des biens"
          role="group"
          className="flex flex-wrap gap-2"
        >
          {tabs.map((item) => (
            <button
              type="button"
              key={item.key}
              aria-pressed={tab === item.key}
              onClick={() => {
                setTab(item.key);
                setPage(1);
              }}
              className={cn(
                "min-h-9 rounded-full border px-3 text-xs font-medium",
                tab === item.key
                  ? "border-[#17221e] bg-[#17221e] text-white"
                  : "border-[#dfddd4] bg-[#fbfaf7]",
              )}
            >
              {item.label}{" "}
              <span className="ml-1 rounded-full bg-[#dce5d7] px-1.5 text-[#274331]">
                {eligible.filter(item.includes).length}
              </span>
            </button>
          ))}
        </div>
        <div
          aria-label="Mode d’affichage"
          role="group"
          className="flex flex-wrap items-center gap-1 rounded-lg border border-[#dfddd4] p-1"
        >
          {views.map(({ key, label, icon: Icon }) => (
            <button
              type="button"
              key={key}
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={cn(
                "flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs",
                view === key && "bg-[#dce5d7] font-semibold",
              )}
            >
              <Icon aria-hidden="true" className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <CommercialPanel className="flex flex-wrap items-start gap-2 p-3">
        <label className="relative min-w-40 flex-1">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-3 size-4 text-[#59645f]"
          />
          <input
            aria-label="Rechercher un bien"
            placeholder="Rechercher un bien…"
            className={cn(fieldClass, "w-full pl-9")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <Filter
          label={types.length ? `Types (${types.length})` : "Type de bien"}
          active={types.length > 0}
        >
          {propertyKinds.map((type) => (
            <label key={type} className="flex gap-2">
              <input
                type="checkbox"
                checked={types.includes(type)}
                onChange={(e) => {
                  setTypes((current) =>
                    e.target.checked
                      ? [...current, type]
                      : current.filter((value) => value !== type),
                  );
                  setPage(1);
                }}
              />
              {propertyTypeLabels[type]}
            </label>
          ))}
        </Filter>
        <Filter label={city || "Secteur"} active={Boolean(city)}>
          <select
            className={fieldClass}
            aria-label="Commune"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Toutes les communes</option>
            {cities.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Filter>
        <Filter label="Prix" active={Boolean(price.min || price.max)}>
          <RangeFields
            value={price}
            unit="€"
            onChange={(value) => {
              setPrice(value);
              setPage(1);
            }}
          />
        </Filter>
        <Filter label="Surface" active={Boolean(surface.min || surface.max)}>
          <RangeFields
            value={surface}
            unit="m²"
            onChange={(value) => {
              setSurface(value);
              setPage(1);
            }}
          />
        </Filter>
        <Filter
          label={advisorNames.get(advisor) ?? "Conseiller"}
          active={Boolean(advisor)}
        >
          <select
            className={fieldClass}
            aria-label="Conseiller responsable"
            value={advisor}
            onChange={(e) => {
              setAdvisor(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous les conseillers</option>
            <option value="unassigned">Non attribué</option>
            {advisors.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter
          label="Plus de filtres"
          active={Boolean(withoutPhoto || featured || dpe)}
        >
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={withoutPhoto}
              onChange={(e) => {
                setWithoutPhoto(e.target.checked);
                setPage(1);
              }}
            />
            Photo manquante
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => {
                setFeatured(e.target.checked);
                setPage(1);
              }}
            />
            À la une
          </label>
          <select
            aria-label="Classe DPE"
            className={fieldClass}
            value={dpe}
            onChange={(e) => {
              setDpe(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Toutes classes DPE</option>
            {[..."ABCDEFG"].map((letter) => (
              <option key={letter}>{letter}</option>
            ))}
          </select>
        </Filter>
        {filterActive ? (
          <button
            type="button"
            className={commercialSecondaryButton}
            onClick={resetFilters}
          >
            Réinitialiser
          </button>
        ) : null}
      </CommercialPanel>

      {filtered.length === 0 ? (
        <BentoEmptyState
          title="Aucun bien trouvé"
          description="Modifiez les filtres ou ajoutez un bien au portefeuille."
        />
      ) : null}
      {filtered.length > 0 && view === "gallery" ? (
        <div className="grid gap-4">
          {rows.map((p) => (
            <CommercialPanel className="overflow-hidden" key={p.id}>
              <div className="relative">
                <PropertyPhoto property={p} className={styles.portfolioCover} />
                <span className="absolute left-4 top-4 rounded-full bg-[#17221e] px-3 py-1 text-xs text-white">
                  {propertyTypeLabels[p.type]}
                </span>
              </div>
              <div className="grid gap-3 p-4">
                <div>
                  <h3>{openTitle(p)}</h3>
                  <p className="text-xs text-[#59645f]">
                    {p.city} {p.postalCode} · Réf. {p.reference}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{formatPrice(p.price)}</strong>
                  <span className="text-xs">
                    {p.surface} m²{p.rooms ? ` · ${p.rooms} p.` : ""}
                    {p.bedrooms ? ` · ${p.bedrooms} ch.` : ""}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#dfddd4] pt-2 text-xs">
                  <span>
                    {advisorNames.get(p.advisorId ?? "") ??
                      "Conseiller non attribué"}
                  </span>
                  <PropertyStatusBadge property={p} />
                  {actions(p)}
                </div>
              </div>
            </CommercialPanel>
          ))}
        </div>
      ) : null}
      {filtered.length > 0 && view === "compact" ? (
        <CommercialPanel>{rows.map((p) => compactRow(p))}</CommercialPanel>
      ) : null}
      {filtered.length > 0 && view === "table" ? (
        <CommercialPanel className="min-w-0 max-w-full">
          {selected.length ? (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              {selected.length} sélectionné(s){" "}
              <button
                type="button"
                className={commercialSecondaryButton}
                onClick={() => setSelection(new Set())}
              >
                Effacer la sélection
              </button>
            </div>
          ) : null}
          <div className={styles.mobileTable}>
            <div className="flex flex-wrap items-center gap-2 border-b border-[#dfddd4] p-3 text-xs">
              <label className="flex min-w-0 items-center gap-2">
                Trier par
                <select
                  aria-label="Colonne de tri"
                  className={fieldClass}
                  value={sort.key}
                  onChange={(event) =>
                    selectSort(event.target.value as SortKey)
                  }
                >
                  {sortChoices.map(({ key, label }) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={commercialSecondaryButton}
                onClick={() => selectSort(sort.key)}
              >
                {sort.ascending ? "Croissant" : "Décroissant"}
              </button>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedCount === rows.length}
                  ref={(element) => {
                    if (element)
                      element.indeterminate =
                        selectedCount > 0 && selectedCount < rows.length;
                  }}
                  onChange={(event) =>
                    toggleSelected(
                      rows.map((p) => p.id),
                      event.target.checked,
                    )
                  }
                />
                Sélectionner cette page
              </label>
            </div>
            {rows.map((p) => (
              <div
                key={p.id}
                className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b border-[#dfddd4] px-3 last:border-0"
              >
                <input
                  type="checkbox"
                  aria-label={`Sélectionner ${p.title}`}
                  checked={selection.has(p.id)}
                  onChange={(event) =>
                    toggleSelected([p.id], event.target.checked)
                  }
                />
                {compactRow(p)}
              </div>
            ))}
          </div>
          <div
            role="region"
            aria-label="Tableau des biens, défilement horizontal"
            tabIndex={0}
            className={cn("min-w-0 w-full", styles.desktopTable)}
          >
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-[#efeee9]">
                <tr>
                  <th scope="col" className="p-3">
                    <input
                      type="checkbox"
                      aria-label="Sélectionner les biens de cette page"
                      checked={selectedCount === rows.length}
                      ref={(element) => {
                        if (element)
                          element.indeterminate =
                            selectedCount > 0 && selectedCount < rows.length;
                      }}
                      onChange={(e) =>
                        toggleSelected(
                          rows.map((p) => p.id),
                          e.target.checked,
                        )
                      }
                    />
                  </th>
                  <th scope="col" className="p-3">
                    Photo
                  </th>
                  {sortChoices.map(({ key, label }) => (
                    <th
                      scope="col"
                      key={key}
                      className="p-3 text-xs"
                      aria-sort={
                        sort.key === key
                          ? sort.ascending
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button type="button" onClick={() => selectSort(key)}>
                        {label}{" "}
                        {sort.key === key ? (sort.ascending ? "↑" : "↓") : null}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="p-3">
                    <span className="sr-only">Mise à la une</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t border-[#dfddd4]">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner ${p.title}`}
                        checked={selection.has(p.id)}
                        onChange={(e) =>
                          toggleSelected([p.id], e.target.checked)
                        }
                      />
                    </td>
                    <td className="p-2">
                      <PropertyPhoto property={p} className="size-11 rounded" />
                    </td>
                    <td className="p-2">{p.reference}</td>
                    <td className="p-2">
                      {openTitle(p)}
                      <p className="text-xs text-[#59645f]">{p.city}</p>
                    </td>
                    <td className="p-2">{propertyTypeLabels[p.type]}</td>
                    <td className="p-2">{p.surface} m²</td>
                    <td className="whitespace-nowrap p-2 font-semibold">
                      {formatPrice(p.price)}
                    </td>
                    <td className="p-2">
                      {advisorNames.get(p.advisorId ?? "") ?? "—"}
                    </td>
                    <td className="p-2">
                      <PropertyStatusBadge property={p} />
                    </td>
                    <td className="whitespace-nowrap p-2">
                      {new Date(p.updatedAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="p-2">{actions(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CommercialPanel>
      ) : null}
      {filtered.length > 0 && view === "map" ? (
        <PropertyCommuneView
          properties={filtered}
          postalCodes={postalCodes}
          renderRow={compactRow}
        />
      ) : null}
      {view !== "map" && filtered.length > 0 ? (
        <nav
          aria-label="Pagination des biens"
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <span>
            Page {activePage} sur {pageCount} · {filtered.length} bien(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={commercialSecondaryButton}
              disabled={activePage === 1}
              onClick={() => setPage(activePage - 1)}
            >
              Précédent
            </button>
            <button
              type="button"
              className={commercialSecondaryButton}
              disabled={activePage === pageCount}
              onClick={() => setPage(activePage + 1)}
            >
              Suivant
            </button>
          </div>
        </nav>
      ) : null}
      {missingPhotoCount ? (
        <CommercialPanel className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
          <p>
            <strong>Alertes sur le portefeuille</strong>
            <br />
            {missingPhotoCount} bien(s) sans photo principale
          </p>
          <button
            type="button"
            className={commercialSecondaryButton}
            onClick={() => {
              resetFilters();
              setTab("incomplete");
              setWithoutPhoto(true);
            }}
          >
            Afficher les biens concernés
          </button>
        </CommercialPanel>
      ) : null}
      {exportOpen ? (
        <CommercialDialog
          title="Exporter les biens"
          onClose={() => setExportOpen(false)}
        >
          <p className="text-sm text-[#59645f]">
            Le CSV contient les références, localisations publiques, surfaces,
            prix et statuts.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={commercialPrimaryButton}
              onClick={() => {
                exportProperties(filtered);
                setExportOpen(false);
              }}
            >
              Résultats filtrés ({filtered.length})
            </button>
            {selected.length ? (
              <button
                type="button"
                className={commercialSecondaryButton}
                onClick={() => {
                  exportProperties(selected);
                  setExportOpen(false);
                }}
              >
                Sélection ({selected.length})
              </button>
            ) : null}
          </div>
        </CommercialDialog>
      ) : null}
    </section>
  );
}
