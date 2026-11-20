"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { BarChart3, Building2, CalendarDays, Database, House, Mail, Map, Search, Send, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { adminRoleLabels, adminRoles } from "@/types/admin";
import { parseSettingsContactsCsv, settingsHref, type AgencySettings, type NotificationPrefs, type SettingsData, type SettingsMember } from "@/lib/crm-settings";
import Link from "next/link";
import styles from "./settings.module.css";

export const settingsApi = "/api/admin/settings";
export const field = "h-10 w-full rounded-lg border border-[#dedfd4] bg-[#fbfaf7] px-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#2f493a]";
export const primary = "rounded-lg bg-[#2f493a] font-semibold text-white hover:bg-[#233b2e]";
export const textAction = "inline-flex min-h-9 items-center rounded-md px-2 text-xs font-semibold text-[#2f493a] underline-offset-4 hover:underline focus-visible:outline-2";

export async function settingsRequest<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method, cache: "no-store", signal,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new Error(result?.message || "Le CRM n’a pas répondu. Réessayez.");
  return result as T;
}

export const settingsError = (error: unknown) => error instanceof Error ? error.message : "L’action n’a pas pu être effectuée.";
const clock = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
export const settingsDate = (date: string | null) => date ? clock.format(new Date(date)) : "—";
export type MutateSettings = (body: unknown, message: string) => Promise<boolean>;

export function SettingsCard({ title, children, description }: { title: string; children: ReactNode; description?: string }) {
  return <section className={styles.card}>
    <h2 className={styles.cardTitle}>{title}</h2>
    {description ? <p className={styles.muted}>{description}</p> : null}
    {children}
  </section>;
}

export function SettingsTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  if (!rows.length) return <p className={styles.empty}>Aucune donnée disponible.</p>;
  return <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr>{headers.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody>
  </table></div>;
}

function Chip({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <span className={cn(styles.chip, muted && styles.chipMuted)}><span aria-hidden="true" />{children}</span>;
}

const agencyFields = [
  ["name", "Nom de l’agence"], ["address", "Adresse"], ["phone", "Téléphone"], ["email", "E-mail de contact"],
  ["website", "Site web"], ["siret", "SIRET"], ["professionalCard", "N° de carte professionnelle"],
] as const;

export function AgencyPanel({ data, mutate, busy }: { data: SettingsData; mutate: MutateSettings; busy: boolean }) {
  const [edit, setEdit] = useState<keyof AgencySettings | null>(null);
  const info = data.agency;
  if (!info) return null;
  const save = async (event: FormEvent<HTMLFormElement>, key: keyof AgencySettings) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("value") ?? "").trim();
    if (await mutate({ action: "agency", information: { ...info, [key]: value }, expected: data.revision ?? null }, "Les informations de l’agence ont été enregistrées.")) setEdit(null);
  };
  return <>
    <SettingsCard title="Informations de l’agence">
      <dl>{agencyFields.map(([key, label]) => <div className={styles.row} key={key}>
        {edit === key ? <form className="flex w-full flex-wrap items-end gap-2" onSubmit={event => save(event, key)}>
          <label className="grid min-w-32 flex-1 gap-1 text-sm font-medium">{label}<Input name="value" type={key === "email" ? "email" : key === "website" ? "url" : "text"} defaultValue={info[key]} required={key === "name"} autoFocus /></label>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setEdit(null)}>Annuler</Button>
          <Button className={primary} disabled={busy} type="submit">Enregistrer</Button>
        </form> : <>
          <div><dt className={styles.micro}>{label}</dt><dd className={styles.value}>{info[key] || "À renseigner"}</dd></div>
          {data.canManageAgency ? <button type="button" className={textAction} aria-label={`Modifier ${label}`} onClick={() => setEdit(key)}>Modifier</button> : null}
        </>}
      </div>)}</dl>
    </SettingsCard>
    {data.team ? <SettingsCard title="Équipe"><TeamTable members={data.team} /></SettingsCard> : null}
    <SettingsCard title="Préférences de l’application">
      <dl>
        <div className={styles.row}><div><dt className={styles.micro}>Fuseau horaire</dt><dd className={styles.value}>Europe/Paris</dd></div><Link href="/admin?tab=agenda" className={textAction}>Ouvrir l’Agenda</Link></div>
        <div className={styles.row}><div><dt className={styles.micro}>Devise</dt><dd className={styles.value}>EUR (€) — Euro</dd></div><Link href="/admin?tab=statistics&report=commercial" className={textAction}>Voir les rapports</Link></div>
      </dl>
    </SettingsCard>
  </>;
}

function MemberIdentity({ row }: { row: SettingsMember }) {
  const name = row.full_name || row.email;
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase()).join("");
  return <div className={styles.identity}>
    <span className={styles.avatar} aria-hidden="true">{initials}</span>
    <div><p className="font-semibold">{name}</p>{row.full_name ? <p className={styles.muted}>{row.email}</p> : null}</div>
  </div>;
}

function TeamTable({ members, actions }: { members: SettingsMember[]; actions?: (row: SettingsMember) => ReactNode }) {
  const headers = ["Utilisateur", "Rôle", "Statut", "Dernière connexion"];
  if (actions) headers.push("Actions");
  const rows = members.map(row => {
    const cells: ReactNode[] = [
      <MemberIdentity key="identity" row={row} />, adminRoleLabels[row.role],
      <Chip key="status" muted={!row.is_active}>{row.is_active ? "Actif" : "Inactif"}</Chip>,
      settingsDate(row.last_sign_in_at),
    ];
    if (actions) cells.push(actions(row));
    return cells;
  });
  return <SettingsTable headers={headers} rows={rows} />;
}

export function UsersPanel({ data, mutate, busy }: { data: SettingsData; mutate: MutateSettings; busy: boolean }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<SettingsMember | null>(null);
  const members = (data.team ?? []).filter(row => [row.email, row.full_name, adminRoleLabels[row.role]].some(text => text?.toLocaleLowerCase("fr-FR").includes(query.toLocaleLowerCase("fr-FR").trim())));
  const saveMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    if (await mutate({ action: "member", id: editing.id, name: form.get("name"), role: form.get("role") ?? editing.role, active: editing.is_active, expected: editing.updated_at }, "Utilisateur mis à jour.")) setEditing(null);
  };
  const toggle = async (row: SettingsMember) => {
    if (row.is_active && !window.confirm(`Désactiver l’accès CRM de ${row.full_name || row.email} ?`)) return;
    await mutate({ action: "member", id: row.id, name: row.full_name || row.email, role: row.role, active: !row.is_active, expected: row.updated_at }, row.is_active ? "Accès CRM désactivé." : "Accès CRM réactivé.");
  };
  return <SettingsCard title="Gestion des utilisateurs">
    <Input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label="Rechercher un utilisateur" placeholder="Rechercher un utilisateur…" className="max-w-sm" />
    <TeamTable members={members} actions={data.canManageUsers ? row => <div className="flex flex-wrap gap-1">
      <button type="button" className={textAction} onClick={() => setEditing(row)} aria-label={`Modifier ${row.full_name || row.email}`}>Modifier</button>
      {row.id !== data.viewerId ? <button type="button" disabled={busy} className={cn(textAction, row.is_active && "text-[#a2473e]")} onClick={() => void toggle(row)}>
        {row.is_active ? "Désactiver" : "Réactiver"}
      </button> : null}
    </div> : undefined} />
    {editing ? <Sheet open onOpenChange={open => { if (!open && !busy) setEditing(null); }}>
      <SheetContent className="w-full overflow-y-auto p-5 sm:max-w-lg">
        <SheetHeader className="p-0 pr-8"><SheetTitle>Modifier l’utilisateur</SheetTitle><SheetDescription>{editing.email}</SheetDescription></SheetHeader>
        <form onSubmit={saveMember} className="grid gap-4">
          <label className="grid gap-1">Nom complet<Input name="name" defaultValue={editing.full_name ?? editing.email} required maxLength={120} /></label>
          <label className="grid gap-1">Rôle<select name="role" className={field} defaultValue={editing.role} disabled={editing.id === data.viewerId}>
            {adminRoles.map(role => <option key={role} value={role}>{adminRoleLabels[role]}</option>)}
          </select></label>
          <Button type="submit" className={primary} disabled={busy}>Enregistrer</Button>
        </form>
      </SheetContent>
    </Sheet> : null}
  </SettingsCard>;
}

export function RolesPanel({ data }: { data: SettingsData }) {
  return <>
    <SettingsCard title="Gestion des rôles" description="Les droits ci-dessous sont ceux appliqués par le CRM. Les dossiers restent soumis au périmètre de chaque rôle.">
      <ul className={styles.roleList}>{adminRoles.map(role => <li key={role}>
        <strong>{adminRoleLabels[role]}</strong>
        {data.team ? <Chip>{data.team.filter(row => row.role === role && row.is_active).length} actif(s)</Chip> : null}
        {data.canManageUsers ? <Link className={textAction} href={settingsHref("users")}>Gérer les attributions</Link> : null}
      </li>)}</ul>
    </SettingsCard>
    <SettingsCard title="Matrice des permissions"><SettingsTable headers={["Module", ...adminRoles.map(role => adminRoleLabels[role])]}
      rows={(data.permissions ?? []).map(row => [row.label, ...adminRoles.map(role => row.roles[role] ?? "—")])} /></SettingsCard>
  </>;
}

const notificationGroups = [
  { title: "Activité commerciale", items: [
    ["contact", "Nouveau contact assigné", "Contacts récents de votre portefeuille."],
    ["estimate", "Estimation demandée", "Demandes d’estimation qui vous sont attribuées."],
    ["visit", "Visite planifiée", "Visites à venir qui vous sont attribuées."],
    ["offer", "Offre reçue", "Offres enregistrées pour votre portefeuille commercial."],
  ] },
  { title: "Agenda", items: [
    ["reminder", "Rappel de rendez-vous", "Délai par défaut utilisé dans la cloche du CRM."],
    ["overdue", "Tâche en retard", "Tâches ouvertes dont votre échéance est dépassée."],
  ] },
  { title: "Système", items: [
    ["release", "Mise à jour de l’application", "Information publiée à l’occasion d’une mise à jour."],
    ["weekly", "Rapport hebdomadaire", "Accès au bilan CRM de la semaine précédente."],
  ] },
] as const;

export function NotificationsPanel({ preferences, mutate, busy }: { preferences: NotificationPrefs; mutate: MutateSettings; busy: boolean }) {
  const [draft, setDraft] = useState(preferences);
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void mutate({ action: "notifications", preferences: draft }, "Préférences enregistrées.");
  };
  return <>
    <SettingsCard title="Préférences de notification">
      <form onSubmit={save}>
        {notificationGroups.map(group => <fieldset className={styles.group} key={group.title}>
          <legend>{group.title}</legend>
          {group.items.map(([key, label, description]) => <div key={key} className={styles.row}>
            <div><p className={styles.value}>{label}</p><p className={styles.muted}>{description}</p>
              {key === "reminder" && draft.reminder ? <label className="mt-2 flex flex-wrap items-center gap-2 text-xs">Délai en minutes
                <Input type="number" min={0} max={10080} required value={draft.reminderMinutes} onChange={event => setDraft({ ...draft, reminderMinutes: event.target.valueAsNumber })} className="w-24" />
              </label> : null}
            </div>
            <button className={styles.switch} type="button" role="switch" aria-label={label} aria-checked={draft[key]} onClick={() => setDraft({ ...draft, [key]: !draft[key] })}><span aria-hidden="true" /></button>
          </div>)}
        </fieldset>)}
        <Button type="submit" disabled={busy} className={primary}>Enregistrer</Button>
      </form>
    </SettingsCard>
    <SettingsCard title="Canaux de notification">
      {[
        ["Dans le CRM", "La cloche affiche les notifications selon vos préférences.", true],
        ["E-mail", "Les relances transactionnelles ont leur propre intégration.", false],
        ["Notification push", "Le raccordement d’un service de notification est requis.", false],
        ["SMS", "Un fournisseur et une règle de diffusion doivent être configurés.", false],
      ].map(([label, description, enabled]) => <div className={styles.row} key={String(label)}><div><p className={styles.value}>{label}</p><p className={styles.muted}>{description}</p></div>
        <Chip muted={!enabled}>{enabled ? "Actif" : "À connecter"}</Chip></div>)}
      <Link className={textAction} href={settingsHref("integrations")}>Voir les intégrations</Link>
    </SettingsCard>
  </>;
}

const integrationIcons = {
  SeLoger: House, LeBonCoin: ShoppingBag, "Logic-Immo": Building2, "Bien’ici": Map,
  "Google Calendar": CalendarDays, Mailchimp: Mail, "Google Analytics 4": BarChart3, "Google Search Console": Search,
  "Relances commerciales": Send, "Supabase CRM": Database,
};

export function IntegrationsPanel({ data }: { data: SettingsData }) {
  return <SettingsCard title="Services connectés">
    <div className={styles.integrations}>{data.integrations?.map(service => {
      const Icon = integrationIcons[service.name as keyof typeof integrationIcons] ?? Database;
      return <article className={styles.integration} key={service.name}>
        <div className="flex flex-wrap items-start justify-between gap-2"><span className={styles.integrationIcon}><Icon size={18} aria-hidden="true" /></span>
          <Chip muted={service.state === "missing"}>{{ ready: "Connecté", configured: "À vérifier", missing: "À connecter" }[service.state]}</Chip></div>
        <h3 className="font-semibold">{service.name}</h3>
        <p className={styles.muted}>{service.description}</p>
        <Link className={textAction} href={service.action.href}>{service.action.label}</Link>
      </article>;
    })}</div>
  </SettingsCard>;
}

export function ReferencesPanel({ data, section }: { data: SettingsData; section: "property-types" | "statuses" | "sources" }) {
  const title = { "property-types": "Types de biens", statuses: "Statuts du CRM", sources: "Sources d’acquisition" }[section];
  return <SettingsCard title={title} description="Référentiel des valeurs utilisées par les modules et leur nombre d’enregistrements dans votre périmètre.">
    <SettingsTable headers={["Module", "Libellé", "Code", "Enregistrements"]}
      rows={(data.references ?? []).map(row => [row.group ?? "CRM", row.label, row.code, row.count])} />
    <Link className={textAction} href={section === "property-types" ? "/admin?tab=properties" : section === "sources" ? "/admin?tab=statistics&report=contacts" : "/commercial/pipeline"}>Ouvrir le module associé</Link>
  </SettingsCard>;
}

export function DataPanel({ data }: { data: SettingsData }) {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const preview = csv ? parseSettingsContactsCsv(csv) : null;
  async function importContacts() {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await settingsRequest<{ inserted: number; skipped: number }>(settingsApi, "POST", { csv, confirm: true });
      setFeedback({ error: false, text: `${result.inserted} contact(s) créé(s), ${result.skipped} doublon(s) ignoré(s).` });
      setCsv("");
    } catch (error) {
      setFeedback({ error: true, text: settingsError(error) });
    } finally {
      setBusy(false);
    }
  }
  return <>
    {data.canManageAgency ? <SettingsCard title="Importer des contacts" description="Prévisualisez jusqu’à 200 lignes. Les contacts déjà présents sont conservés.">
      <a className={textAction} href={`${settingsApi}?section=data&template=contacts`}>Télécharger le modèle CSV</a>
      <label className="grid gap-2 text-sm font-medium">Fichier CSV
        <Input type="file" accept=".csv,text/csv" disabled={busy} onChange={async event => {
          const file = event.target.files?.[0];
          setFeedback(null);
          if (!file) { setCsv(""); return; }
          if (file.size > 130_000) { setCsv(""); setFeedback({ text: "Le fichier dépasse la taille autorisée.", error: true }); return; }
          try { setCsv(await file.text()); }
          catch { setCsv(""); setFeedback({ text: "Lecture du fichier impossible.", error: true }); }
        }} />
      </label>
      {preview?.errors.length ? <ul role="alert" className="text-sm text-[#a2473e]">{preview.errors.slice(0, 6).map(error => <li key={error}>{error}</li>)}</ul> : null}
      {preview?.rows.length && !preview.errors.length ? <>
        <SettingsTable headers={["Nom", "E-mail", "Téléphone", "Ville"]} rows={preview.rows.slice(0, 8).map(row => [row.name, row.email, row.phone, row.city])} />
        <Button type="button" className={primary} disabled={busy} onClick={() => void importContacts()}>Importer {preview.rows.length} contact(s)</Button>
      </> : null}
      {feedback ? <p role={feedback.error ? "alert" : "status"} className={feedback.error ? "text-[#a2473e]" : "text-[#2f493a]"}>{feedback.text}</p> : null}
    </SettingsCard> : null}
    <SettingsCard title="Exporter les données">
      <div className="flex flex-wrap gap-2">
        {data.canExportContacts ? <Link className={textAction} href="/admin?tab=contacts">Exporter depuis les Contacts</Link> : null}
        <Link className={textAction} href="/admin?tab=statistics">Exporter un rapport statistique</Link>
      </div>
    </SettingsCard>
  </>;
}
