import "server-only";

import { agencyContact } from "@/components/site/site-config";
import { propertyTypeLabels } from "@/data/properties";
import { crmTokenClaims, getCrmAuthTokens, hasAdminPermission, permissionMatrix } from "@/lib/admin-auth";
import { contactQualificationStatusLabels, leadStatusLabels } from "@/lib/crm";
import { contactPermissions } from "@/lib/contact-rules";
import { propertyPublicationLabels } from "@/lib/property-workspace";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { adminRoles, type AdminSession } from "@/types/admin";
import { canSeeSales } from "@/lib/statistics-data";
import {
  agencySettingsSchema, defaultNotificationPrefs, isAgencyManager, notificationPrefsSchema,
  type PermissionLine, type SettingsData, type SettingsIntegration, type SettingsReference, type SettingsSection,
} from "./crm-settings";

export type SettingsDb = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
type DbResult<T> = { data: T | null; error: { code: string } | null };
export function readSettingsRows<T>(result: DbResult<T>): T {
  if (result.error) throw new Error(`Paramètres CRM (${result.error.code})`);
  return result.data as T;
}

const initialAgency = agencySettingsSchema.parse({
  name: agencyContact.name, address: agencyContact.address, phone: agencyContact.phone, email: agencyContact.email,
  website: agencyContact.website, siret: agencyContact.siret, professionalCard: "",
});

export async function getCrmAgencyInformation() {
  const db = getSupabaseAdminClient();
  if (!db) return initialAgency;
  const { data, error } = await db.from("crm_agency_settings").select("information").eq("id", true).maybeSingle();
  if (error && !["42P01", "PGRST205"].includes(error.code)) console.warn("[Fiche d’agence]", error.code);
  const stored = agencySettingsSchema.safeParse(data?.information);
  return stored.success ? stored.data : initialAgency;
}

export async function readNotificationPreferences(db: SettingsDb, userId: string) {
  const result = await db.from("crm_user_settings").select("preferences,inbox_seen_at").eq("user_id", userId).maybeSingle();
  const row = readSettingsRows(result);
  const parsed = notificationPrefsSchema.safeParse(row?.preferences ?? {});
  return { preferences: parsed.success ? parsed.data : defaultNotificationPrefs, seenAt: row?.inbox_seen_at ?? null };
}

function integrationCards(): SettingsIntegration[] {
  const portal = (name: string): SettingsIntegration => ({
    name, state: "missing",
    description: "Passerelle dédiée à raccorder avec le contrat de diffusion de l’agence.",
    action: { href: "/admin?tab=properties", label: "Ouvrir le portefeuille" },
  });
  const creds = Boolean(process.env.CRM_GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.CRM_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  const ga4 = creds && /^\d+$/.test(process.env.CRM_GA4_PROPERTY_ID?.trim() ?? "");
  const search = creds && Boolean(process.env.CRM_SEARCH_CONSOLE_SITE);
  const webhook = Boolean(process.env.CRM_TRANSACTIONAL_COMMUNICATION_WEBHOOK_URL && process.env.CRM_TRANSACTIONAL_COMMUNICATION_WEBHOOK_TOKEN);
  return [
    portal("SeLoger"), portal("LeBonCoin"), portal("Logic-Immo"), portal("Bien’ici"),
    { name: "Google Calendar", state: "missing", description: "L’agenda CRM conserve les rendez-vous. Une connexion OAuth et le choix du calendrier sont requis pour les synchroniser.", action: { href: "/admin?tab=agenda", label: "Ouvrir l’Agenda" } },
    { name: "Mailchimp", state: "missing", description: "Le raccordement dépend de l’audience d’agence et des règles de consentement validées.", action: { href: "/admin?tab=contacts", label: "Ouvrir les Contacts" } },
    { name: "Google Analytics 4", state: ga4 ? "configured" : "missing", description: "Lecture des données d’audience. La vue Statistiques confirme que la propriété répond.", action: { href: "/admin?tab=statistics&report=web", label: "Ouvrir l’analyse web" } },
    { name: "Google Search Console", state: search ? "configured" : "missing", description: "Lecture des requêtes, clics et impressions. Le compte de service doit avoir accès à la propriété.", action: { href: "/admin?tab=statistics&report=web", label: "Ouvrir l’analyse web" } },
    { name: "Relances commerciales", state: webhook ? "configured" : "missing", description: "Webhook transactionnel des relances d’offres. Le paramétrage se fait côté serveur.", action: { href: "/commercial/negociations", label: "Ouvrir les négociations" } },
    { name: "Supabase CRM", state: "ready", description: "Stockage des données et authentification du CRM.", action: { href: "/admin", label: "Ouvrir le CRM" } },
  ];
}

function currentPermissions(): PermissionLine[] {
  const modules = [
    { label: "Contacts", read: "crm.read", write: "lead.write", remove: "lead.delete" },
    { label: "Biens", read: "crm.read", write: "property.write", remove: "property.delete" },
    { label: "Offres", read: "offers", write: "offer.write", remove: "offer.decide" },
    { label: "Agenda", read: "crm.read", write: "lead.write", remove: "lead.delete" },
    { label: "Statistiques", read: "crm.read" },
    { label: "Journal de l’agence", read: "audit.read" },
    { label: "Paramètres d’agence", read: "crm.read", write: "agency" },
    { label: "Gestion des utilisateurs", read: "agency", write: "users.manage" },
  ] as const;
  return modules.map(module => ({ label: module.label, roles: Object.fromEntries(adminRoles.map(role => {
    const has = (permission: string) => permission === "agency" ? isAgencyManager(role)
      : permission === "offers" ? canSeeSales(role) : permissionMatrix[role].some(item => item === permission);
    if (!has(module.read)) return [role, "—"];
    const access = ["Lecture"];
    if ("write" in module && has(module.write)) access.push("Écriture");
    if ("remove" in module && has(module.remove)) access.push(module.label === "Offres" ? "Décision" : "Suppression");
    return [role, access.join(" · ")];
  })) }));
}

function referenceRows(values: string[], labels: Record<string, string>, group: string) {
  const counts = new Map<string, number>();
  for (const code of values) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...new Set([...Object.keys(labels), ...counts.keys()])].map((code): SettingsReference => ({ code, label: labels[code] ?? code, count: counts.get(code) ?? 0, group }));
}

type Page<T> = PromiseLike<DbResult<T[]>>;
export async function readSettingsPages<T>(load: (start: number, end: number) => Page<T>) {
  const result: T[] = [];
  for (let start = 0; ; start += 500) {
    const rows = readSettingsRows(await load(start, start + 499)) ?? [];
    result.push(...rows);
    if (rows.length < 500) return result;
  }
}

export async function loadCrmSettings(db: SettingsDb, session: AdminSession, section: SettingsSection): Promise<SettingsData> {
  const role = session.profile.role, owner = session.user.id, agencyManager = isAgencyManager(role);
  const base: SettingsData = { canManageAgency: agencyManager, canManageUsers: hasAdminPermission(role, "users.manage"), canExportContacts: contactPermissions(role).canExport, viewerId: owner };
  if (section === "agency") {
    const [registry, team] = await Promise.all([
      db.from("crm_agency_settings").select("information,updated_at").eq("id", true).maybeSingle(),
      agencyManager ? db.rpc("read_crm_team", { p_actor: owner }) : null,
    ]);
    const row = readSettingsRows(registry);
    return { ...base, agency: row ? agencySettingsSchema.parse(row.information) : initialAgency, revision: row?.updated_at ?? null, team: team ? readSettingsRows(team) ?? [] : undefined };
  }
  if (section === "users" || section === "roles") {
    const team = agencyManager ? readSettingsRows(await db.rpc("read_crm_team", { p_actor: owner })) ?? [] : undefined;
    return { ...base, team, ...(section === "roles" ? { permissions: currentPermissions() } : {}) };
  }
  if (section === "notifications") return { ...base, preferences: (await readNotificationPreferences(db, owner)).preferences };
  if (section === "integrations") {
    const health = await db.from("crm_agency_settings").select("id", { head: true, count: "exact" });
    if (health.error) throw new Error("Connexion au stockage des paramètres indisponible.");
    return { ...base, integrations: integrationCards() };
  }
  if (section === "security") {
    const { access_token } = await getCrmAuthTokens();
    const { session_id } = crmTokenClaims(access_token);
    const history = db.from("audit_logs").select("id,created_at,actor_email,action,entity_type")
      .or("action.like.admin.*,action.like.settings.*,action.like.auth.*");
    const [sessions, audit, authUser] = await Promise.all([
      db.rpc("read_crm_sessions", { p_actor: owner }),
      (hasAdminPermission(role, "audit.read") ? history : history.eq("actor_id", owner)).order("created_at", { ascending: false }).limit(20),
      db.auth.admin.getUserById(owner),
    ]);
    if (authUser.error) throw new Error("Compte Auth indisponible");
    return {
      ...base,
      sessions: (readSettingsRows(sessions) ?? []).map(row => ({ ...row, current: row.id === session_id })),
      audit: readSettingsRows(audit) ?? [],
      mfaEnabled: authUser.data.user?.factors?.some(row => row.factor_type === "totp" && row.status === "verified") ?? false,
      profile: { name: session.profile.full_name, email: session.user.email, role },
    };
  }
  if (section === "property-types" || section === "statuses") {
    const properties = db.from("properties").select("id,type,publication_status");
    const rows = await readSettingsPages((from, to) => (role === "AGENT" ? properties.eq("advisor_id", owner) : properties).order("id").range(from, to));
    if (section === "property-types") return { ...base, references: referenceRows(rows.map(row => row.type), propertyTypeLabels, "Biens") };
    const contacts = db.from("contacts").select("id,qualification_status").is("canonical_contact_id", null);
    const leads = db.from("leads").select("id,status");
    const [people, files] = await Promise.all([
      readSettingsPages((from, to) => (role === "AGENT" ? contacts.eq("assigned_to", owner) : contacts).order("id").range(from, to)),
      readSettingsPages((from, to) => (role === "AGENT" ? leads.eq("assigned_to", owner) : leads).order("id").range(from, to)),
    ]);
    return { ...base, references: [
      ...referenceRows(people.map(row => row.qualification_status), contactQualificationStatusLabels, "Contacts"),
      ...referenceRows(files.map(row => row.status), leadStatusLabels, "Dossiers"),
      ...referenceRows(rows.map(row => row.publication_status), propertyPublicationLabels, "Publication"),
    ] };
  }
  if (section === "sources") {
    const contacts = db.from("contacts").select("id,contact_source").is("canonical_contact_id", null);
    const rows = await readSettingsPages((from, to) => (role === "AGENT" ? contacts.eq("assigned_to", owner) : contacts).order("id").range(from, to));
    return { ...base, references: referenceRows(rows.map(row => row.contact_source), {
      AGENCY: "Saisie CRM", WEBSITE: "Site web", IMPORT_CSV: "Import CSV", LEGACY_IMPORT: "Import historique", LESTY_GED_CONTACT: "Import Lesty",
    }, "Contacts") };
  }
  return base;
}
