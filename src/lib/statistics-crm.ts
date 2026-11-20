import { dayDate, parisDay, shiftAgendaDay, weekStart } from "./agenda-time";
import { commercialLabel } from "./commercial-presentation";
import {
  comparisonPeriod, dayDifference, formatStatistic, formatStatisticsDate, inStatisticsPeriod,
  mean, periodLength, rate, relativeChange, reportDay, statisticsHref,
  type ChartBlock, type Figure, type StatisticAlert, type StatisticsAdvisor,
  type StatisticsBlock, type StatisticsMetric, type StatisticsPeriod, type StatisticsReport, type StatisticsView,
} from "./statistics";
import type { StatisticsData } from "./statistics-data";

type Contact = StatisticsData["contacts"][number];
type Estimate = StatisticsData["estimates"][number];
type Property = StatisticsData["properties"][number];
type Visit = StatisticsData["visits"][number];
type Sale = NonNullable<StatisticsData["sales"]>[number];

const contactsHref = "/admin?tab=contacts";
const propertiesHref = "/admin?tab=properties";
const pipelineHref = "/commercial/pipeline";
const estimatesHref = "/commercial/estimations";
const visitsHref = "/commercial/visites";
const propertyHref = (id: string) => `${propertiesHref}&property=${id}`;
const estimateHref = (id: string) => `${estimatesHref}/${id}`;
const visitHref = (id: string) => `${visitsHref}/${id}`;
const options: Intl.DateTimeFormatOptions = { timeZone: "UTC", month: "short" };
const monthFormat = new Intl.DateTimeFormat("fr-FR", options);
const dayFormat = new Intl.DateTimeFormat("fr-FR", { ...options, day: "numeric" });

function chart(kind: ChartBlock["kind"], title: string, rows: [string, ...Figure[]][], series = ["Nombre"], details: Pick<ChartBlock, "unit" | "note" | "wide"> = {}): ChartBlock {
  return { kind, title, points: rows.map(([label, ...values]) => ({ label, values })), series, ...details };
}

function grouped<T>(rows: T[], getKey: (row: T) => string | null) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row)?.trim() || "Non renseigné";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b, "fr"));
}

function top(rows: [string, number][], limit = 8): [string, number][] {
  if (rows.length <= limit) return rows;
  return [...rows.slice(0, limit - 1), ["Autres", rows.slice(limit - 1).reduce((sum, [, value]) => sum + value, 0)]];
}

const sourceNames: Record<string, string> = {
  WEBSITE: "Site web", WEB: "Site web", SITE: "Site web", SITE_WEB: "Site web",
  REFERRAL: "Recommandation", RECOMMENDATION: "Recommandation", PORTAL: "Portails",
  SOCIAL: "Réseaux sociaux", SOCIAL_MEDIA: "Réseaux sociaux", PHONE: "Téléphone",
  MANUAL: "Saisie CRM", LESTY_GED_CONTACT: "Import Lesty", LEGACY_IMPORT: "Import historique",
};
const typeNames: Record<string, string> = {
  apartment: "Appartement", house: "Maison", villa: "Villa", land: "Terrain",
  commercial: "Commerce", parking: "Stationnement", other: "Autres biens",
};
const projectNames: Record<string, string> = { buyer: "Achat", seller: "Vente", mixed: "Achat et vente", general: "Projet à préciser", investment: "Investissement", primary_residence: "Résidence principale", secondary_residence: "Résidence secondaire" };

const sourceLabel = ({ contact_source }: Contact) =>
  sourceNames[contact_source.toUpperCase()] ?? contact_source.replaceAll("_", " ").trim();
const propertyType = (value: string) => typeNames[value.toLowerCase()] ?? value;
const isQualified = (contact: Contact, to: string) => Boolean(contact.qualified_at && reportDay(contact.qualified_at) <= to);
const isActiveContact = ({ archived, qualification_status, status }: Contact) => !archived && !["INACTIVE", "DUPLICATE", "NO_CONTACT"].includes(qualification_status) && status !== "LOST";
const isSold = (property: Property) => (property.commercial_status ?? property.status.toUpperCase()) === "SOLD";
const isUnderOffer = (property: Property) => (property.commercial_status ?? property.status.toUpperCase()) === "UNDER_OFFER";
const isActiveProperty = (property: Property) => property.publication_status === "PUBLISHED" && !isSold(property);
const startedEstimate = (estimate: Estimate) => estimate.requested_at ?? estimate.created_at;
const completedEstimate = (estimate: Estimate) => {
  if (!["COMPLETED", "REPORT_SENT", "FINISHED"].includes(estimate.commercial_status)) return null;
  return estimate.report_generated_at ?? estimate.appointment_at;
};
const estimatedPrice = (estimate: Estimate) =>
  estimate.estimated_value ?? (estimate.estimate_low && estimate.estimate_high ? (estimate.estimate_low + estimate.estimate_high) / 2 : null);
const estimateOutcome = (estimate: Estimate) => {
  if (estimate.commercial_status === "FINISHED" || estimate.status === "MANDATE_SIGNED") return "Mandat signé";
  if (estimate.commercial_status === "NO_FOLLOW_UP" || estimate.status === "LOST") return "Sans suite";
  return commercialLabel(estimate.commercial_status);
};
const offerDate = (offer: StatisticsData["offers"][number]) => offer.offered_at ?? offer.created_at;
const isSearchActive = ({ status }: StatisticsData["searches"][number]) => status.toLowerCase() === "active";
const sumFees = (sales: Sale[] | null) => sales?.reduce((sum, row) => sum + row.fee_excl_tax, 0) ?? null;
const dated = <T,>(rows: T[], period: StatisticsPeriod, date: (row: T) => string | null) => rows.filter((row) => inStatisticsPeriod(date(row), period));
const sumPositive = (values: (number | null)[]) => values.filter((value): value is number => value !== null && value > 0);
const propertyStatus = (row: Property) => {
  if (row.publication_status === "ARCHIVED") return "Archivés";
  if (isSold(row)) return "Vendus";
  if (isUnderOffer(row)) return "Sous offre";
  if (row.publication_status === "PUBLISHED") return "Publiés";
  return row.publication_status === "UNPUBLISHED" ? "Dépubliés" : "À compléter";
};

function timeline(period: StatisticsPeriod) {
  const length = periodLength(period);
  const buckets: (StatisticsPeriod & { label: string })[] = [];
  let first = period.from;
  while (first <= period.to) {
    const next = dayDate(first);
    if (length > 63) next.setUTCMonth(next.getUTCMonth() + 1, 1);
    const boundary = length > 63 ? next.toISOString().slice(0, 10) : shiftAgendaDay(first, length <= 14 ? 1 : 7);
    const last = shiftAgendaDay(boundary, -1);
    buckets.push({ from: first, to: last < period.to ? last : period.to, label: (length > 63 ? monthFormat : dayFormat).format(dayDate(first)) });
    first = boundary;
  }
  return buckets;
}

function placeCounts(data: StatisticsData, period: StatisticsPeriod): [string, number][] {
  const positions = new Map<string, Set<string>>();
  function record(contact: string, city: string | null) {
    const display = city?.trim();
    if (!display) return;
    const key = display.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr-FR");
    const values = positions.get(key) ?? new Set<string>();
    values.add(contact);
    positions.set(key, values);
  }
  const labels = new Map<string, string>();
  const remember = (contact: string, city: string | null) => {
    if (!city?.trim()) return;
    labels.set(city.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(), city.trim());
    record(contact, city);
  };
  dated(data.searches, period, row => row.created_at).filter(isSearchActive)
    .forEach(row => row.cities.forEach(city => remember(row.contact_id ?? row.id, city)));
  dated(data.leads, period, row => row.created_at).filter(row => row.pipeline_type === "BUYER" && !row.archived)
    .forEach(row => remember(row.contact_id ?? row.id, row.city));
  return [...positions].map(([key, values]): [string, number] => [labels.get(key) ?? key, values.size])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
}

function activeMandate(row: StatisticsData["mandates"][number], today: string) {
  return Boolean(row.signed_at && row.signed_at <= today && (!row.expires_at || row.expires_at >= today)
    && !["CANCELLED", "EXPIRED", "ARCHIVED", "TERMINATED", "DRAFT"].includes(row.status.toUpperCase()));
}

function saleConversion(data: StatisticsData, period: StatisticsPeriod) {
  if (!data.sales) return null;
  const buyerDeals = dated(data.leads, period, row => row.created_at).filter(row => row.pipeline_type === "BUYER");
  const sales = new Set(dated(data.sales, period, row => row.signed_on).map(row => row.property_id));
  const linked = new Set(buyerDeals.flatMap(row => row.linked_property_id && sales.has(row.linked_property_id) ? [row.linked_property_id] : []));
  return rate(linked.size, buyerDeals.length);
}

function propertyAge(row: Property, today: string) {
  return row.published_at ? Math.max(0, dayDifference(reportDay(row.published_at), today)) : null;
}

function buildRisk(data: StatisticsData, today: string) {
  const active = data.properties.filter(isActiveProperty);
  const completed = data.visits.filter(row => row.visit_status === "COMPLETED");
  const latestVisit = new Map<string, string>();
  for (const visit of completed) {
    if (!visit.property_id) continue;
    const day = reportDay(visit.starts_at);
    if (day > today) continue;
    if (day > (latestVisit.get(visit.property_id) ?? "")) latestVisit.set(visit.property_id, day);
  }
  const idle = active.flatMap(row => {
    const previous = latestVisit.get(row.id);
    const published = row.published_at ? reportDay(row.published_at) : null;
    const anchor = previous && (!published || previous > published) ? previous : published;
    return anchor && dayDifference(anchor, today) >= 30 ? [{ row, age: dayDifference(anchor, today) }] : [];
  }).sort((a, b) => b.age - a.age);
  const cold = data.contacts.filter(row => isActiveContact(row) && dayDifference(reportDay(row.last_contacted_at ?? row.created_at), today) >= 5);
  const stale = data.estimates.filter(row => !row.archived
    && !["FINISHED", "NO_FOLLOW_UP"].includes(row.commercial_status) && !["LOST", "MANDATE_SIGNED"].includes(row.status)
    && !(row.appointment_at && reportDay(row.appointment_at) >= today)
    && dayDifference(reportDay(row.updated_at), today) >= 10);
  const overdue = data.tasks.filter(row => row.due_at && reportDay(row.due_at) < today && !row.completed_at && !["COMPLETED", "CANCELLED"].includes(row.status));
  return { active, idle, cold, stale, overdue };
}

type Request = {
  view: Exclude<StatisticsView, "web">;
  period: StatisticsPeriod;
  now: Date;
  advisors: StatisticsAdvisor[];
  selectedAdvisor: string | null;
  team: boolean;
  canRecordSales: boolean;
  offersVisible: boolean;
};

export function advisorData(data: StatisticsData, advisor: string): StatisticsData {
  const contacts = data.contacts.filter(row => row.assigned_to === advisor);
  const properties = data.properties.filter(row => row.advisor_id === advisor);
  const leads = data.leads.filter(row => row.assigned_to === advisor);
  const contactIds = new Set(contacts.map(row => row.id));
  const leadIds = new Set(leads.map(row => row.id));
  const propertyIds = new Set(properties.map(row => row.id));
  return {
    ...data, contacts, properties, leads,
    estimates: data.estimates.filter(row => row.assigned_to === advisor),
    visits: data.visits.filter(row => row.assigned_to === advisor),
    offers: data.offers.filter(row => row.responsible_user_id === advisor),
    mandates: data.mandates.filter(row => row.lead_id ? leadIds.has(row.lead_id) : row.property_id && propertyIds.has(row.property_id)),
    tasks: data.tasks.filter(row => row.assigned_to === advisor),
    interactions: data.interactions.filter(row => row.contact_id && contactIds.has(row.contact_id)),
    searches: data.searches.filter(row => row.assigned_to === advisor),
    sales: data.sales?.filter(row => row.advisor_id === advisor) ?? null,
  };
}

export function buildCrmStatistics(allData: StatisticsData, request: Request): StatisticsReport {
  const { view, period, now, advisors, selectedAdvisor, team, offersVisible } = request;
  const data = selectedAdvisor ? advisorData(allData, selectedAdvisor) : allData;
  const today = parisDay(now);
  const previous = comparisonPeriod(period);
  const buckets = timeline(period);
  const incoming = dated(data.contacts, period, row => row.created_at);
  const qualified = dated(data.contacts, period, row => row.qualified_at);
  const activeContacts = data.contacts.filter(isActiveContact);
  const estimates = dated(data.estimates, period, startedEstimate);
  const completed = dated(data.estimates, period, completedEstimate);
  const visits = dated(data.visits, period, row => row.starts_at).filter(row => row.visit_status === "COMPLETED");
  const offers = dated(data.offers, period, offerDate);
  const mandates = dated(data.mandates, period, row => row.signed_at);
  const sales = data.sales && dated(data.sales, period, row => row.signed_on);
  const previousSales = data.sales && dated(data.sales, previous, row => row.signed_on);
  const conversion = saleConversion(data, period);
  const conversionBefore = saleConversion(data, previous);
  const risk = buildRisk(data, today);
  const propertyNames = new Map(allData.properties.map(row => [row.id, row]));
  const advisorNames = new Map(advisors.map(row => [row.id, row.label]));
  const advisorLabel = (id: string | null) => (id && advisorNames.get(id)) || "Non attribué";
  const currentNote = "Situation actuelle du CRM, indépendamment de la période affichée.";
  const accessNote = "Indicateur accessible aux rôles commerciaux.";
  const alerts: StatisticAlert[] = [];
  const metrics: StatisticsMetric[] = [];
  const blocks: StatisticsBlock[] = [];
  let action: StatisticsReport["action"];

  if (risk.stale.length) alerts.push({ label: `${risk.stale.length} estimation(s) sans suivi depuis 10 jours`, detail: "Estimations ouvertes, sans rendez-vous à venir.", level: "critical", action: { label: "Voir les estimations", href: estimatesHref } });
  if (conversion !== null && conversionBefore !== null && conversion < conversionBefore) alerts.push({ label: `Taux de transformation en baisse de ${formatStatistic(conversionBefore - conversion, "decimal")} points`, detail: "Comparaison avec la période précédente de même durée.", level: "critical", action: { label: "Analyser", href: statisticsHref("commercial", period, selectedAdvisor) } });
  if (risk.idle.length) alerts.push({ label: `${risk.idle.length} bien(s) sans visite depuis 30 jours`, detail: "Annonces publiées sans visite réalisée récemment.", level: "moderate", action: { label: "Analyser les biens", href: statisticsHref("properties", period, selectedAdvisor) } });
  if (risk.cold.length) alerts.push({ label: `${risk.cold.length} contact(s) sans relance depuis 5 jours`, detail: "Dernier contact enregistré ou date de création.", level: "moderate", action: { label: "Voir les contacts", href: contactsHref } });
  if (risk.overdue.length) alerts.push({ label: `${risk.overdue.length} tâche(s) en retard`, detail: "Tâches ouvertes dont l’échéance est dépassée.", level: "critical", action: { label: "Ouvrir les tâches", href: "/admin?tab=agenda&view=tasks" } });
  const opportunities = data.estimates.filter(row => !row.archived && ["COMPLETED", "REPORT_SENT"].includes(row.commercial_status))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 3);
  for (const row of opportunities) alerts.push({ label: `Préparer le suivi d’une estimation à ${row.city || "renseigner"}`, detail: "Estimation réalisée ou rapport envoyé, mandat à confirmer.", level: "opportunity", action: { label: "Ouvrir l’estimation", href: estimateHref(row.id) } });
  const unscheduled = data.leads.filter(row => !row.archived && row.pipeline_stage === "BUYER_QUALIFIED"
    && row.linked_property_id && !data.visits.some(visit => visit.lead_id === row.id && visit.visit_status !== "CANCELLED"));
  if (unscheduled.length) alerts.push({ label: `${unscheduled.length} dossier(s) qualifié(s) avec un bien à visiter`, detail: "Un bien est associé au dossier. Aucun créneau actif n’est enregistré.", level: "opportunity", action: { label: "Voir le pipeline", href: pipelineHref } });

  const qualifiedRate = (range: StatisticsPeriod) => {
    const contacts = dated(data.contacts, range, row => row.created_at);
    return rate(contacts.filter(row => isQualified(row, range.to)).length, contacts.length);
  };
  const advisorsInReport = advisors.filter(row => (row.active || row.id === selectedAdvisor) && (!selectedAdvisor || row.id === selectedAdvisor));
  const advisorSummary = (view === "overview" || view === "advisors" ? advisorsInReport : []).map(advisor => {
    const advisorRows = advisorData(allData, advisor.id);
    const contactedIds = new Set(dated(advisorRows.interactions, period, row => row.created_at).map(row => row.contact_id));
    for (const row of dated(advisorRows.contacts, period, row => row.last_contacted_at)) contactedIds.add(row.id);
    const active = dated(advisorRows.contacts, period, row => row.created_at);
    const advisorSales = advisorRows.sales && dated(advisorRows.sales, period, row => row.signed_on);
    const prior = advisorRows.sales && dated(advisorRows.sales, previous, row => row.signed_on);
    const displayedOffers = dated(advisorRows.offers, period, offerDate);
    return {
      advisor, created: active.length, processed: contactedIds.size,
      qualified: rate(active.filter(row => isQualified(row, period.to)).length, active.length),
      visits: dated(advisorRows.visits, period, row => row.starts_at).filter(row => row.visit_status === "COMPLETED").length,
      estimates: dated(advisorRows.estimates, period, completedEstimate).length,
      offers: offersVisible ? displayedOffers.length : null,
      acceptance: offersVisible ? rate(displayedOffers.filter(row => inStatisticsPeriod(row.accepted_at, period)).length, displayedOffers.length) : null,
      mandates: dated(advisorRows.mandates, period, row => row.signed_at).length,
      sales: advisorSales?.length ?? null, fees: sumFees(advisorSales), change: relativeChange(sumFees(advisorSales), sumFees(prior)),
      closing: saleConversion(advisorRows, period), contactRate: rate(active.filter(row => contactedIds.has(row.id)).length, active.length),
    };
  });
  const advisorLabels = advisorSummary.map(row => row.advisor.label);
  const advisorChart = (includeEstimates: boolean) => chart("columns", includeEstimates ? "Performance par vendeur" : "Performance comparée (volume)", [
    ["Contacts", ...advisorSummary.map(row => includeEstimates ? row.created : row.processed)],
    ["Visites", ...advisorSummary.map(row => row.visits)],
    ...(includeEstimates ? [["Estimations", ...advisorSummary.map(row => row.estimates)] as [string, ...Figure[]]] : []),
    ["Offres", ...advisorSummary.map(row => row.offers)],
  ], advisorLabels);

  if (view === "overview") {
    metrics.push(
      { label: "Nouveaux contacts", value: incoming.length, change: relativeChange(incoming.length, dated(data.contacts, previous, row => row.created_at).length) },
      { label: "Contacts qualifiés", value: qualified.length, note: `${formatStatistic(qualifiedRate(period), "percent")} des nouveaux contacts qualifiés avant la fin de la période.` },
      { label: "Estimations réalisées", value: completed.length },
      { label: "Mandats obtenus", value: mandates.length },
      { label: "Visites", value: visits.length, note: "Visites réalisées." },
      { label: "Ventes", value: sales?.length ?? null, note: sales ? `Honoraires déclarés HT · ${formatStatistic(sumFees(sales), "currency")}` : accessNote },
    );
    const buyers = dated(data.leads, period, row => row.created_at).filter(row => row.pipeline_type === "BUYER" && row.status !== "LOST");
    const steps = ["BUYER_NEW", "BUYER_QUALIFIED", "BUYER_VISIT", "BUYER_OFFER", "BUYER_COMPROMISE", "BUYER_FINALIZED"];
    blocks.push(
      chart("line", "Évolution des contacts", buckets.map(bucket => [bucket.label, dated(incoming, bucket, row => row.created_at).length, dated(qualified, bucket, row => row.qualified_at).length]), ["Nouveaux", "Qualifiés"]),
      chart("donut", "Origine des contacts", top(grouped(incoming, sourceLabel))),
      chart("bar", "Progression du pipeline", ["Nouveaux", "Qualifiés", "Visite", "Offre", "Compromis", "Finalisé"].map((label, index) => [label, buyers.filter(row => row.pipeline_stage === steps[index]).length]), ["Dossiers"], { note: "Étapes actuelles des dossiers acquéreurs ouverts sur la période." }),
      advisorChart(true),
      chart("bar", "Biens par statut", grouped(data.properties, propertyStatus), ["Biens"], { note: currentNote }),
      chart("bar", "Secteurs les plus demandés", top(placeCounts(data, period)), ["Demandes ou dossiers"], { note: "Un demandeur est compté une fois par commune souhaitée." }),
      { kind: "alerts", title: "Points à surveiller", alerts: alerts.filter(row => row.level !== "opportunity"), wide: true },
    );
  }

  if (view === "commercial") {
    const ranked = [...(sales ?? [])].sort((a, b) => b.sale_price - a.sale_price);
    const latest = [...(sales ?? [])].sort((a, b) => b.signed_on.localeCompare(a.signed_on));
    const feeGroups = new Map<string, number>();
    const days = (sales ?? []).flatMap(row => {
      const published = propertyNames.get(row.property_id)?.published_at;
      if (!published) return [];
      const daysOnMarket = dayDifference(reportDay(published), row.signed_on);
      return daysOnMarket < 0 ? [] : [daysOnMarket];
    });
    const propertyLabel = (id: string) => propertyNames.get(id)?.title ?? "Bien lié à la vente";
    const recorded = new Set(data.sales?.map(row => row.property_id));
    const missingActs = data.properties.filter(row => isSold(row) && !recorded.has(row.id)).length;
    for (const row of sales ?? []) {
      const type = propertyNames.get(row.property_id)?.type;
      const label = type ? propertyType(type) : "Type non renseigné";
      feeGroups.set(label, (feeGroups.get(label) ?? 0) + row.fee_excl_tax);
    }
    metrics.push(
      { label: "CA total", value: sumFees(sales), unit: "currency", change: relativeChange(sumFees(sales), sumFees(previousSales)), note: sales ? "Honoraires HT déclarés sur les actes signés." : accessNote },
      { label: "Honoraires moyens", value: mean((sales ?? []).map(row => row.fee_excl_tax)), unit: "currency" },
      { label: "Taux de transformation", value: conversion, unit: "percent", change: relativeChange(conversion, conversionBefore, true), note: "Ventes distinctes liées aux dossiers acquéreurs de la période, rapportées à ces dossiers." },
      { label: "Délai moyen de vente", value: mean(days), unit: "days", note: `${days.length} vente(s) avec date de publication exploitable.` },
    );
    if (!sales) blocks.push({ kind: "notice", title: "Résultats de vente", note: accessNote, wide: true });
    else blocks.push(
      chart("line", "Évolution du CA", buckets.map(bucket => [bucket.label, sumFees(dated(sales, bucket, row => row.signed_on))]), ["Honoraires HT"], { unit: "currency" }),
      chart("donut", "Répartition par type de bien", [...feeGroups], ["Honoraires HT"], { unit: "currency" }),
      chart("bar", "Top 5 biens vendus", ranked.slice(0, 5).map(row => [propertyLabel(row.property_id), row.sale_price]), ["Prix signé"], { unit: "currency", wide: true }),
      { kind: "table", title: "Dernières ventes conclues", columns: ["Bien", "Vendeur", "Prix signé", "Date", "Honoraires HT"], rows: latest.slice(0, 20).map(row => ({ cells: [propertyLabel(row.property_id), advisorLabel(row.advisor_id), formatStatistic(row.sale_price, "currency"), formatStatisticsDate(row.signed_on), formatStatistic(row.fee_excl_tax, "currency")], href: propertyHref(row.property_id) })), wide: true },
    );
    if (sales && missingActs) blocks.push({ kind: "notice", title: "Couverture du registre des ventes", note: `${missingActs} bien(s) marqué(s) Vendu sans acte renseigné, toutes dates confondues dans ce périmètre.`, wide: true });
  }

  if (view === "advisors") {
    const processed = new Set(dated(data.interactions, period, row => row.created_at).map(row => row.contact_id));
    for (const row of dated(data.contacts, period, row => row.last_contacted_at)) processed.add(row.id);
    metrics.push({ label: "Contacts traités", value: processed.size }, { label: "Visites réalisées", value: visits.length },
      { label: "Offres obtenues", value: offersVisible ? offers.length : null }, { label: "Ventes conclues", value: sales?.length ?? null });
    blocks.push(advisorChart(false),
      chart("bar", "Profil de compétences (%)", [
        ["Prospection", ...advisorSummary.map(row => row.contactRate)],
        ["Négociation", ...advisorSummary.map(row => row.acceptance)],
        ["Closing", ...advisorSummary.map(row => row.closing)],
        ["Relationnel", ...advisorSummary.map(row => row.qualified)],
      ], advisorLabels, { unit: "percent", note: "Ratios observés : contact, acceptation des offres, vente et qualification. Les taux sans effectif sont indisponibles." }),
      { kind: "table", title: "Classement et efficacité commerciale", columns: ["Conseiller", "Mandats rentrés", "Taux de conversion", "CA généré HT", "Tendance"], rows: [...advisorSummary].sort((a, b) => (b.fees ?? 0) - (a.fees ?? 0) || b.mandates - a.mandates).map(row => ({
        cells: [row.advisor.label, row.mandates, formatStatistic(row.closing, "percent"), formatStatistic(row.fees, "currency"), row.change ?? "—"],
        href: statisticsHref("advisors", period, row.advisor.id),
      })), wide: true });
  }

  if (view === "contacts") {
    const firstReplies = new Map<string, string>();
    const cohort = new Map(incoming.map(row => [row.id, row]));
    for (const message of data.interactions) {
      const contact = message.contact_id && cohort.get(message.contact_id);
      if (!contact || Date.parse(message.created_at) < Date.parse(contact.created_at) || reportDay(message.created_at) > period.to) continue;
      const previousReply = firstReplies.get(contact.id);
      if (!previousReply || Date.parse(previousReply) > Date.parse(message.created_at)) firstReplies.set(contact.id, message.created_at);
    }
    const delays = [...firstReplies].map(([id, when]) => (Date.parse(when) - Date.parse(cohort.get(id)!.created_at)) / 3_600_000);
    const q = incoming.filter(row => isQualified(row, period.to));
    const buyerContacts = new Set(data.leads.filter(row => !row.archived && row.pipeline_type === "BUYER" && reportDay(row.created_at) <= period.to).map(row => row.contact_id));
    const searching = q.filter(row => buyerContacts.has(row.id));
    const visitContacts = new Set(data.visits.filter(row => row.visit_status === "COMPLETED" && reportDay(row.starts_at) <= period.to).map(row => row.contact_id));
    const visited = searching.filter(row => visitContacts.has(row.id));
    const offered = new Set(data.offers.filter(row => reportDay(offerDate(row)) <= period.to).map(row => row.buyer_contact_id));
    metrics.push({ label: "Nouveaux contacts", value: incoming.length, change: relativeChange(incoming.length, dated(data.contacts, previous, row => row.created_at).length) },
      { label: "Taux de qualification", value: qualifiedRate(period), unit: "percent", change: relativeChange(qualifiedRate(period), qualifiedRate(previous), true) },
      { label: "Temps moyen de réponse", value: mean(delays), unit: "hours", note: `${delays.length} première(s) interaction(s) tracée(s) après la création.` },
      { label: "Contacts actifs", value: activeContacts.length, note: currentNote });
    const projects = dated(data.leads, period, row => row.created_at).filter(row => row.contact_id && cohort.has(row.contact_id));
    blocks.push(
      chart("bar", "Entonnoir de qualification", [["Nouveau", rate(incoming.length, incoming.length)], ["Qualifié", rate(q.length, incoming.length)], ["En recherche", rate(searching.length, incoming.length)], ["Visite", rate(visited.length, incoming.length)], ["Offre", offersVisible ? rate(visited.filter(row => offered.has(row.id)).length, incoming.length) : null]], ["Taux"], { unit: "percent", note: `Cohorte de ${incoming.length} contacts acquis. Chaque étape conserve les contacts de l’étape précédente.` }),
      chart("donut", "Répartition par type de projet", top(grouped(projects, row => row.project_type ? projectNames[row.project_type.toLowerCase()] ?? row.project_type : null)), ["Dossiers"]),
      chart("columns", "Tendance d’acquisition", buckets.map(bucket => [bucket.label, dated(incoming, bucket, row => row.created_at).length])),
      chart("bar", "Contacts par source et statut", top(grouped(incoming, sourceLabel)).filter(([label]) => label !== "Autres").map(([label]) => {
        const fromSource = incoming.filter(row => sourceLabel(row) === label);
        const qualified = fromSource.filter(row => isQualified(row, period.to)).length;
        return [label, qualified, fromSource.length - qualified];
      }), ["Qualifiés", "À qualifier"]),
    );
  }

  if (view === "pipeline") {
    const stock = data.properties.filter(row => row.publication_status !== "ARCHIVED" && !isSold(row));
    const active = data.mandates.filter(row => activeMandate(row, today));
    const mandateProperties = new Set(active.map(row => row.property_id));
    const valued = stock.filter(row => mandateProperties.has(row.id) && row.price > 0);
    const currentDeals = data.leads.filter(row => !row.archived && row.status !== "LOST");
    const blocked = currentDeals.filter(row => row.is_blocked && row.linked_property_id);
    const stepCount = (stage: string) => currentDeals.filter(row => row.pipeline_stage === stage).length;
    metrics.push({ label: "Pipeline total", value: stock.length, note: "Biens de vente non archivés et non vendus." },
      { label: "Valeur totale", value: valued.length ? valued.reduce((sum, row) => sum + row.price, 0) : active.length ? null : 0, unit: "currency", note: `${active.length} mandat(s) actif(s) · ${valued.length} bien(s) avec prix.` },
      { label: "Durée moyenne", value: mean(stock.flatMap(row => { const age = propertyAge(row, today); return age === null ? [] : [age]; })), unit: "days", note: currentNote },
      { label: "Taux de conversion", value: conversion, unit: "percent", change: relativeChange(conversion, conversionBefore, true) });
    action = { label: "Détail du portefeuille", href: propertiesHref };
    blocks.push(chart("bar", "Progression du pipeline par étape", [["Estimation", stepCount("SELLER_ESTIMATE_SCHEDULED") + stepCount("SELLER_ESTIMATE_DONE")], ["Mandat", stepCount("SELLER_MANDATE_SIGNED")], ["Publication", stepCount("SELLER_MARKETED")], ["Compromis", stepCount("BUYER_COMPROMISE")]], ["Dossiers"], { note: currentNote }),
      chart("bar", "Biens par tranche de prix", priceRanges(stock, [250_000, 500_000]), ["Biens"]),
      chart("line", "Évolution des entrées au pipeline", buckets.map(bucket => [bucket.label, dated(data.leads, bucket, row => row.created_at).length]), ["Dossiers ouverts"]),
      { kind: "alerts", title: "Alertes · Biens bloqués", alerts: [
        ...blocked.slice(0, 8).map((row): StatisticAlert => ({ label: propertyNames.get(row.linked_property_id!)?.title ?? "Dossier lié à un bien", detail: row.stage_entered_at ? `En étape depuis le ${formatStatisticsDate(row.stage_entered_at)}` : "Blocage signalé dans le pipeline.", level: "critical", action: { label: "Ouvrir le dossier", href: `${pipelineHref}?dossier=${row.id}` } })),
        ...alerts.filter(row => row.label.includes("sans visite")),
      ] });
  }

  if (view === "estimates") {
    const signed = estimates.filter(row => {
      const linkedLeadIds = new Set(data.leads.filter(lead => lead.estimation_id === row.id).map(lead => lead.id));
      return data.mandates.some(mandate => mandate.signed_at && mandate.signed_at <= period.to && (
        (mandate.property_id && mandate.property_id === row.converted_property_id) || (mandate.lead_id && linkedLeadIds.has(mandate.lead_id))
      ));
    });
    metrics.push({ label: "Estimations sur la période", value: estimates.length, change: relativeChange(estimates.length, dated(data.estimates, previous, startedEstimate).length) },
      { label: "En attente de mandat", value: completed.filter(row => !["FINISHED", "NO_FOLLOW_UP"].includes(row.commercial_status)).length },
      { label: "Taux de conversion", value: rate(signed.length, estimates.length), unit: "percent", note: `${signed.length} mandat(s) signé(s) relié(s) aux ${estimates.length} demandes de la période.` },
      { label: "Valeur moyenne estimée", value: mean(sumPositive(estimates.map(estimatedPrice))), unit: "currency" });
    blocks.push(chart("line", "Évolution des estimations", buckets.map(bucket => [bucket.label, dated(estimates, bucket, startedEstimate).length, dated(completed, bucket, completedEstimate).length]), ["Demandées", "Réalisées"]),
      chart("bar", "Estimations par secteur", top(grouped(estimates, row => row.city))),
      { kind: "table", title: "Estimations récentes", columns: ["Secteur", "Type", "Prix estimé", "Statut"], rows: [...estimates].sort((a, b) => startedEstimate(b).localeCompare(startedEstimate(a))).slice(0, 15).map(row => ({ cells: [row.city || "—", `${propertyType(row.property_type)} · ${row.surface} m²`, formatStatistic(estimatedPrice(row), "currency"), estimateOutcome(row)], href: estimateHref(row.id) })) },
      chart("donut", "Résultat des estimations", grouped(estimates, estimateOutcome), ["Demandes"], { note: "Statut actuel des demandes entrées dans la période." }));
  }

  if (view === "visits") {
    const byPair = new Map<string, number>();
    const visitTypes = new Map<string, string>();
    for (const row of [...data.visits].filter(row => row.visit_status === "COMPLETED").sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id))) {
      if (!row.contact_id || !row.property_id) continue;
      const key = `${row.contact_id}:${row.property_id}`;
      const order = (byPair.get(key) ?? 0) + 1;
      byPair.set(key, order);
      visitTypes.set(row.id, order === 1 ? "Première visite" : order === 2 ? "Deuxième visite" : "3e visite et suivantes");
    }
    const secondVisits = visits.filter(row => visitTypes.get(row.id) === "Deuxième visite");
    const converted = new Set(data.offers.filter(row => reportDay(offerDate(row)) <= period.to).map(row => row.created_from_visit_id));
    const upcoming = [...data.visits].filter(row => ["TO_CONFIRM", "CONFIRMED"].includes(row.visit_status) && Date.parse(row.starts_at) >= +now)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 8);
    const bins = visitHeatmap(period, visits);
    const weeks = visitWeeks(period);
    metrics.push({ label: "Visites sur la période", value: visits.length, change: relativeChange(visits.length, dated(data.visits, previous, row => row.starts_at).filter(row => row.visit_status === "COMPLETED").length) },
      { label: "Moyenne par semaine", value: visits.length * 7 / periodLength(period), unit: "decimal" },
      { label: "Taux de 2e visite", value: rate(secondVisits.length, visits.filter(row => visitTypes.has(row.id)).length), unit: "percent", note: "Deuxièmes visites rapportées aux visites réalisées avec un contact et un bien identifiables." },
      { label: "Visites → offre", value: offersVisible ? rate(visits.filter(row => converted.has(row.id)).length, visits.length) : null, unit: "percent", note: "Visites directement liées à une offre enregistrée." });
    blocks.push(chart("heatmap", "Répartition des visites", bins, ["Visites"]),
      chart("columns", "Visites par vendeur et par semaine", weeks.map(bucket => [bucket.label, ...advisorsInReport.map(advisor => dated(visits, bucket, row => row.starts_at).filter(row => row.assigned_to === advisor.id).length)]), advisorsInReport.map(advisor => advisor.label)),
      chart("donut", "Type de visite", grouped(visits, row => visitTypes.get(row.id) ?? null), ["Visites"], { note: "Le rang est calculé sur l’historique des visites réalisées pour le même contact et le même bien." }),
      { kind: "table", title: "Prochaines visites planifiées", columns: ["Visite", "Conseiller", "Créneau"], rows: upcoming.map(row => ({ cells: [row.title, advisorLabel(row.assigned_to), new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(row.starts_at))], href: visitHref(row.id) })), note: currentNote });
  }

  if (view === "properties") {
    const newProperties = dated(data.properties, period, row => row.created_at);
    const activeDms = risk.active.flatMap(row => { const days = propertyAge(row, today); return days === null ? [] : [days]; });
    metrics.push({ label: "Biens actifs", value: risk.active.length, note: "Biens de vente publiés, réservés inclus." },
      { label: "Nouveaux sur la période", value: newProperties.length, change: relativeChange(newProperties.length, dated(data.properties, previous, row => row.created_at).length) },
      { label: "Prix moyen", value: mean(sumPositive(risk.active.map(row => row.price))), unit: "currency", note: "Prix affiché des biens actifs." },
      { label: "DMS moyen", value: mean(activeDms), unit: "days", note: `Durée de commercialisation · ${activeDms.length} bien(s) actif(s) daté(s).` });
    blocks.push(chart("columns", "Biens par tranche de prix", priceRanges(risk.active, [200_000, 400_000, 600_000, 1_000_000]), ["Biens actifs"], { note: currentNote }),
      chart("bar", "Répartition géographique", top(grouped(risk.active, row => row.city)).map(([label, total]) => [label, rate(total, risk.active.length)]), ["Part des biens actifs"], { unit: "percent", note: currentNote }),
      chart("bar", "Biens par type", grouped(risk.active, row => propertyType(row.type)), ["Biens actifs"]),
      { kind: "table", title: "Biens sans activité", columns: ["Bien", "Prix", "Inactivité", "Action suggérée"], rows: risk.idle.slice(0, 20).map(({ row, age }) => ({ cells: [row.title, formatStatistic(row.price, "currency"), `${age} jours sans visite`, isUnderOffer(row) ? "Vérifier le suivi de l’offre" : "Examiner la diffusion"], href: propertyHref(row.id) })), note: currentNote });
  }

  if (view === "alerts") {
    const critical = risk.stale.length + risk.overdue.length + (conversion !== null && conversionBefore !== null && conversion < conversionBefore ? 1 : 0);
    const healthy = rate(risk.active.length - risk.idle.length, risk.active.length);
    metrics.push({ label: "Alertes critiques", value: critical },
      { label: "Alertes modérées", value: risk.idle.length + risk.cold.length },
      { label: "Actions en retard", value: risk.overdue.length },
      { label: "Score santé portefeuille", value: healthy, unit: "percent", note: "Part des biens actifs sans alerte d’inactivité de 30 jours." });
    blocks.push(
      { kind: "alerts", title: "Urgences critiques", alerts: alerts.filter(row => row.level === "critical"), wide: true },
      { kind: "alerts", title: "À surveiller", alerts: alerts.filter(row => row.level === "moderate"), wide: true },
      { kind: "alerts", title: "Suggestions et opportunités", alerts: alerts.filter(row => row.level === "opportunity"), wide: true },
    );
  }

  return { view, period, comparison: previous, generatedAt: now.toISOString(), source: "CRM Riviera · Supabase", metrics, blocks, advisors, selectedAdvisor, team, canRecordSales: request.canRecordSales, action };
}

function priceRanges(properties: Property[], thresholds: number[]): [string, number][] {
  const label = (value: number) => `${value >= 1_000_000 ? value / 1_000_000 + " M€" : value / 1_000 + " k€"}`;
  const bounds = [0, ...thresholds, Infinity];
  const rows: [string, number][] = [];
  for (let index = 0; index < bounds.length - 1; index++) {
    const min = bounds[index], max = bounds[index + 1];
    rows.push([min === 0 ? `< ${label(max)}` : max === Infinity ? `≥ ${label(min)}` : `${label(min)} – ${label(max)}`,
      properties.filter(row => row.price > 0 && row.price >= min && row.price < max).length]);
  }
  return rows;
}

function visitWeeks(period: StatisticsPeriod) {
  const weeks: (StatisticsPeriod & { label: string })[] = [];
  let first = weekStart(period.from);
  while (first <= period.to) {
    const last = shiftAgendaDay(first, 6);
    weeks.push({ from: first < period.from ? period.from : first, to: last < period.to ? last : period.to, label: dayFormat.format(dayDate(first)) });
    first = shiftAgendaDay(first, 7);
  }
  return weeks;
}

function visitHeatmap(period: StatisticsPeriod, visits: Visit[]): [string, Figure][] {
  const dates = new Map(grouped(visits, row => reportDay(row.starts_at)));
  const days: [string, Figure][] = [];
  for (let day = weekStart(period.from); day <= shiftAgendaDay(weekStart(period.to), 6); day = shiftAgendaDay(day, 1)) {
    days.push([day, day >= period.from && day <= period.to ? dates.get(day) ?? 0 : null]);
  }
  return days;
}
