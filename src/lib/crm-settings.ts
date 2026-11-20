import { z } from "zod";
import { adminRoles, type AdminRole } from "@/types/admin";

export const settingsSections = [
  { id: "agency", label: "Agence" },
  { id: "users", label: "Utilisateurs" },
  { id: "roles", label: "Rôles et accès" },
  { id: "property-types", label: "Types de biens" },
  { id: "statuses", label: "Statuts" },
  { id: "sources", label: "Sources" },
  { id: "notifications", label: "Notifications" },
  { id: "integrations", label: "Intégrations" },
  { id: "data", label: "Import / Export" },
  { id: "security", label: "Sécurité" },
] as const;

export type SettingsSection = (typeof settingsSections)[number]["id"];
export const isAgencyManager = (role: AdminRole) => role === "ADMIN" || role === "DIRECTOR";
export const settingsHref = (section: SettingsSection = "agency") => `/admin?tab=settings&section=${section}`;
export const settingsSection = (raw: string | null): SettingsSection => settingsSections.find(item => item.id === raw)?.id ?? "agency";

const optionalText = (max: number) => z.string().trim().max(max);
const businessEmail = z.union([z.literal(""), z.email().max(254)]);
const website = z.union([z.literal(""), z.url({ protocol: /^https?$/ }).max(300)]);

export const agencySettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: optionalText(240),
  phone: optionalText(40),
  email: businessEmail,
  website,
  siret: z.union([z.literal(""), z.string().regex(/^\d{14}$/)]),
  professionalCard: optionalText(80),
});
export type AgencySettings = z.infer<typeof agencySettingsSchema>;

export const notificationPrefsSchema = z.object({
  contact: z.boolean().default(true),
  estimate: z.boolean().default(true),
  visit: z.boolean().default(true),
  offer: z.boolean().default(true),
  reminder: z.boolean().default(true),
  overdue: z.boolean().default(true),
  release: z.boolean().default(false),
  weekly: z.boolean().default(true),
  reminderMinutes: z.number().int().min(0).max(10080).default(30),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
export const defaultNotificationPrefs = notificationPrefsSchema.parse({});

export const userSettingsSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("agency"), information: agencySettingsSchema, expected: z.iso.datetime({ offset: true }).nullable() }),
  z.object({ action: z.literal("member"), id: z.uuid(), name: z.string().trim().min(2).max(120), role: z.enum(adminRoles), active: z.boolean(), expected: z.iso.datetime({ offset: true }) }),
  z.object({ action: z.literal("notifications"), preferences: notificationPrefsSchema }),
  z.object({ action: z.literal("read-inbox") }),
]);

export type SettingsMember = {
  id: string; email: string; full_name: string | null; role: AdminRole;
  is_active: boolean; updated_at: string; last_sign_in_at: string | null;
};
export type SettingsIntegration = {
  name: string; state: "ready" | "configured" | "missing"; description: string;
  action: { href: string; label: string };
};
export type SettingsReference = { code: string; label: string; count: number; group?: string };
export type SettingsAudit = { id: string; created_at: string; actor_email: string; action: string; entity_type: string };
export type SettingsSession = { id: string; created_at: string; last_activity: string; user_agent: string | null; current: boolean };
export type PermissionLine = { label: string; roles: Partial<Record<AdminRole, string>> };
export type SettingsData = {
  canManageAgency: boolean;
  canManageUsers: boolean;
  canExportContacts: boolean;
  viewerId: string;
  agency?: AgencySettings;
  revision?: string | null;
  team?: SettingsMember[];
  permissions?: PermissionLine[];
  preferences?: NotificationPrefs;
  integrations?: SettingsIntegration[];
  references?: SettingsReference[];
  audit?: SettingsAudit[];
  sessions?: SettingsSession[];
  mfaEnabled?: boolean;
  profile?: { name: string | null; email: string; role: AdminRole };
};
export type InboxItem = { id: string; title: string; summary: string; date: string; href: string; unread: boolean };

export const crmPasswordSchema = z.string().min(8).max(72).regex(/[A-Z]/).regex(/[0-9]/);
const totp = z.string().regex(/^\d{6}$/);
export const settingsSecuritySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("password"), current: z.string().min(1).max(1024), next: crmPasswordSchema }).refine(row => row.current !== row.next),
  z.object({ action: z.literal("start-mfa"), current: z.string().min(1).max(1024) }),
  z.object({ action: z.literal("confirm-mfa"), factorId: z.uuid(), code: totp }),
  z.object({ action: z.literal("disable-mfa"), current: z.string().min(1).max(1024), code: totp }),
  z.object({ action: z.literal("revoke-other-sessions") }),
  z.object({ action: z.literal("profile"), name: z.string().trim().min(2).max(120) }),
]);

export type ImportContact = { name: string; email: string; phone: string; city: string };
const contactRow = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform(value => value.toLowerCase()),
  phone: z.string().trim().max(40),
  city: z.string().trim().max(100),
});

export function parseSettingsContactsCsv(raw: string): { rows: ImportContact[]; errors: string[] } {
  const source = raw.replace(/^\uFEFF/, "");
  if (source.length > 130_000) return { rows: [], errors: ["Le fichier dépasse la taille autorisée."] };
  const delimiter = source.split(/\r?\n/, 1)[0].includes(";") ? ";" : ",";
  const records: string[][] = [];
  let fields: string[] = [], cell = "", quoted = false, closed = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
      continue;
    }
    if (char === delimiter || char === "\n" || char === "\r") {
      fields.push(cell.trim());
      cell = "";
      closed = false;
      if (char !== delimiter) {
        if (fields.some(Boolean)) records.push(fields);
        fields = [];
        if (char === "\r" && source[i + 1] === "\n") i += 1;
      }
      continue;
    }
    if (char === '"' && !cell.length && !closed) quoted = true;
    else if (char === '"' || (closed && char.trim())) return { rows: [], errors: ["Guillemets invalides dans le CSV."] };
    else cell += char;
  }
  if (quoted) return { rows: [], errors: ["Guillemets non fermés dans le CSV."] };
  fields.push(cell.trim());
  if (fields.some(Boolean)) records.push(fields);
  const header = records.shift()?.map(value => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase());
  if (!header || header.join(";") !== "nom;email;telephone;ville") return { rows: [], errors: ["Utilisez l’en-tête Nom, Email, Téléphone, Ville du modèle."] };
  if (!records.length || records.length > 200) return { rows: [], errors: ["Le fichier doit contenir entre 1 et 200 contacts."] };
  const rows: ImportContact[] = [];
  const errors: string[] = [];
  for (const [index, values] of records.entries()) {
    const [name, email, phone = "", city = ""] = values;
    const parsed = contactRow.safeParse({ name, email, phone, city });
    if (values.length !== 4 || !parsed.success) errors.push(`Enregistrement ${index + 2} : vérifiez le nom, l’e-mail et les quatre colonnes.`);
    else rows.push(parsed.data);
  }
  return { rows, errors };
}

export const settingsContactsTemplate = "\uFEFFNom;Email;Téléphone;Ville\r\n";
