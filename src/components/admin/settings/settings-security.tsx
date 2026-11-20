"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { adminRoleLabels } from "@/types/admin";
import type { SettingsData } from "@/lib/crm-settings";
import { SettingsCard, SettingsTable, primary, settingsApi, settingsDate, settingsError, settingsRequest, textAction } from "./settings-ui";
import styles from "./settings.module.css";

type SecurityView = "profile" | "password" | "mfa" | "sessions";
type Enrollment = { factorId: string; qr: string; secret: string };
const actionNames: Record<string, string> = {
  "admin.login": "Connexion réussie", "admin.logout": "Déconnexion",
  "settings.password.updated": "Mot de passe modifié", "settings.mfa.enabled": "Double authentification activée",
  "settings.mfa.disabled": "Double authentification désactivée", "settings.sessions.revoked": "Autres sessions déconnectées",
  "settings.profile.updated": "Profil modifié", "settings.agency.updated": "Fiche d’agence modifiée",
  "settings.user.updated": "Accès utilisateur mis à jour", "settings.contacts.imported": "Import de contacts",
};

export function SecurityPanel({ data, onSaved }: { data: SettingsData; onSaved: (message: string) => void }) {
  const [view, setView] = useState<SecurityView | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function open(next: SecurityView | null) {
    setView(next);
    setEnrollment(null);
    setError("");
  }

  async function request(body: unknown, message?: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await settingsRequest<Partial<Enrollment>>(`${settingsApi}/security`, "POST", body);
      if (result.factorId && result.qr && result.secret) {
        setEnrollment({ factorId: result.factorId, qr: result.qr, secret: result.secret });
      } else if (message) {
        open(null);
        onSaved(message);
      }
    } catch (error) {
      setError(settingsError(error));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const current = values.get("current"), code = values.get("code");
    if (view === "profile") return void request({ action: "profile", name: values.get("name") }, "Nom du profil actualisé.");
    if (view === "password") {
      if (values.get("next") !== values.get("confirm")) { setError("Les nouveaux mots de passe doivent être identiques."); return; }
      return void request({ action: "password", current, next: values.get("next") }, "Mot de passe modifié.");
    }
    if (data.mfaEnabled) return void request({ action: "disable-mfa", current, code }, "Double authentification désactivée.");
    if (enrollment) return void request({ action: "confirm-mfa", factorId: enrollment.factorId, code }, "Double authentification activée.");
    return void request({ action: "start-mfa", current });
  }

  const sections = {
    profile: "Modifier le profil", password: "Modifier le mot de passe", mfa: "Authentification à deux facteurs", sessions: "Sessions actives",
  };
  const passwordField = <label className="grid gap-1 text-sm">Mot de passe actuel<Input name="current" autoComplete="current-password" type="password" required /></label>;
  const codeField = <label className="grid gap-1 text-sm">Code de vérification<Input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required /></label>;
  return <>
    <SettingsCard title="Authentification">
      <div className={styles.row}><div><p className={styles.value}>Mon profil</p><p className={styles.muted}>{data.profile?.name || data.profile?.email} · {data.profile ? adminRoleLabels[data.profile.role] : ""}</p></div><button type="button" className={textAction} onClick={() => open("profile")}>Modifier le profil</button></div>
      <div className={styles.row}><div><p className={styles.value}>Mot de passe</p><p className={styles.muted}>Modifiez vos identifiants Supabase Auth.</p></div><button type="button" className={textAction} onClick={() => open("password")}>Modifier le mot de passe</button></div>
      <div className={styles.row}><div><p className={styles.value}>Authentification à deux facteurs</p><p className={styles.muted}>{data.mfaEnabled ? "Activée · application d’authentification" : "À activer · code à usage unique TOTP"}</p></div><button type="button" className={textAction} onClick={() => open("mfa")}>{data.mfaEnabled ? "Gérer la double authentification" : "Configurer"}</button></div>
      <div className={styles.row}><div><p className={styles.value}>Sessions actives</p><p className={styles.muted}>{data.sessions?.length ?? 0} session(s) avec jeton de renouvellement actif.</p></div><button type="button" className={textAction} onClick={() => open("sessions")}>Voir les sessions</button></div>
    </SettingsCard>
    <SettingsCard title="Journal d’activité" description={data.canManageAgency ? "Dernières actions de sécurité et d’administration." : "Dernières actions de sécurité sur votre compte."}>
      <SettingsTable headers={["Date", "Utilisateur", "Action", "Module"]} rows={(data.audit ?? []).map(row => [settingsDate(row.created_at), row.actor_email, actionNames[row.action] ?? row.action, row.entity_type])} />
    </SettingsCard>
    <SettingsCard title="Politique de sécurité">
      <dl>
        <div className={styles.row}><div><dt className={styles.micro}>Complexité minimale</dt><dd className={styles.value}>8 caractères, dont une majuscule et un chiffre</dd></div></div>
        <div className={styles.row}><div><dt className={styles.micro}>Expiration et tentatives</dt><dd className={styles.value}>Gérées dans Supabase Auth</dd></div></div>
      </dl>
    </SettingsCard>
    {view ? <Sheet open onOpenChange={next => { if (!next && !busy) open(null); }}>
      <SheetContent className="w-full overflow-y-auto p-5 sm:max-w-lg">
        <SheetHeader className="p-0 pr-8">
          <SheetTitle>{sections[view]}</SheetTitle>
          <SheetDescription>{view === "mfa" ? "Utilisez un code de votre application d’authentification." : "Réglages de votre propre compte CRM."}</SheetDescription>
        </SheetHeader>
        {view === "sessions" ? <>
          <SettingsTable headers={["Appareil", "Dernière activité"]} rows={(data.sessions ?? []).map(row => [row.current ? "Session actuelle" : row.user_agent || "Appareil non renseigné", settingsDate(row.last_activity)])} />
          <p className={styles.muted}>La révocation empêche les autres sessions de se renouveler. Les jetons d’accès en cours expirent à leur échéance.</p>
          <Button type="button" variant="outline" disabled={busy || (data.sessions?.length ?? 0) < 2}
            onClick={() => void request({ action: "revoke-other-sessions" }, "Autres sessions déconnectées.")}>Déconnecter les autres appareils</Button>
        </> : <form key={enrollment?.factorId ?? view} onSubmit={submit} className="grid gap-4">
          {view === "profile" ? <label className="grid gap-1 text-sm">Nom complet<Input name="name" maxLength={120} defaultValue={data.profile?.name ?? ""} required /></label> : null}
          {view === "password" ? <>{passwordField}
            <label className="grid gap-1 text-sm">Nouveau mot de passe<Input name="next" type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></label>
            <label className="grid gap-1 text-sm">Confirmer le nouveau mot de passe<Input name="confirm" type="password" autoComplete="new-password" required /></label>
          </> : null}
          {view === "mfa" && data.mfaEnabled ? <>{passwordField}{codeField}</> : null}
          {view === "mfa" && !data.mfaEnabled && !enrollment ? passwordField : null}
          {view === "mfa" && enrollment ? <>
            {enrollment.qr.startsWith("data:image/svg+xml;") ? <Image className="rounded-md bg-white p-1" src={enrollment.qr} width={176} height={176} unoptimized alt="QR code de l’application d’authentification" /> : null}
            <p className="text-sm">Clé de configuration <code className="break-all font-semibold">{enrollment.secret}</code></p>
            {codeField}
          </> : null}
          <Button type="submit" className={primary} disabled={busy}>
            {view !== "mfa" ? "Enregistrer" : data.mfaEnabled ? "Désactiver la double authentification" : enrollment ? "Vérifier et activer" : "Afficher le QR code"}
          </Button>
        </form>}
        {error ? <p role="alert" className="text-sm text-[#a2473e]">{error}</p> : null}
      </SheetContent>
    </Sheet> : null}
  </>;
}
