"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BentoCardSkeleton, BentoErrorState } from "@/components/admin/bento/bento-states";
import { settingsHref, settingsSection, settingsSections, type SettingsData, type SettingsSection } from "@/lib/crm-settings";
import { AgencyPanel, DataPanel, IntegrationsPanel, NotificationsPanel, ReferencesPanel, RolesPanel, UsersPanel, field, settingsApi, settingsError, settingsRequest } from "./settings-ui";
import { SecurityPanel } from "./settings-security";
import styles from "./settings.module.css";

export function SettingsWorkspace() {
  const section = settingsSection(useSearchParams().get("section"));
  const router = useRouter();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const [result, setResult] = useState<{ section: SettingsSection; version: number; data?: SettingsData; error?: string } | null>(null);
  const source = result?.section === section && result.version === version ? result : null;
  const data = source?.data;

  useEffect(() => {
    const controller = new AbortController();
    settingsRequest<{ data: SettingsData }>(`${settingsApi}?section=${section}`, "GET", undefined, controller.signal)
      .then(({ data }) => { if (!controller.signal.aborted) setResult({ section, version, data }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ section, version, error: settingsError(error) }); });
    return () => controller.abort();
  }, [section, version]);

  function select(next: SettingsSection) {
    if (next === section || busy) return;
    setFeedback(null);
    window.history.pushState(null, "", settingsHref(next));
  }

  function refresh(message: string) {
    setFeedback({ message, error: false });
    setVersion(current => current + 1);
  }

  async function mutate(body: unknown, message: string) {
    if (busy) return false;
    setBusy(true);
    setFeedback(null);
    try {
      await settingsRequest(settingsApi, "PATCH", body);
      refresh(message);
      if (section === "agency" || section === "users") router.refresh();
      return true;
    } catch (error) {
      setFeedback({ message: settingsError(error), error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return <section aria-label="Paramètres" className={styles.workspace}>
    <header className="hidden md:block"><h1 className="text-3xl font-bold tracking-tight">Paramètres</h1><p className="mt-1 text-sm text-[#58675e]">Configuration du CRM Riviera</p></header>
    <div className={styles.settingsLayout}>
      <div className={styles.mobileSelect}><label htmlFor="settings-section" className="text-xs font-semibold">Rubrique</label>
        <select id="settings-section" className={field} value={section} onChange={event => select(settingsSection(event.target.value))}>
          {settingsSections.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>
      <nav aria-label="Rubriques des paramètres" className={styles.navigation}>
        {settingsSections.map(item => <button key={item.id} type="button" aria-current={section === item.id ? "page" : undefined} disabled={busy}
          onClick={() => select(item.id)}>{item.label}{section === item.id ? <ChevronRight className="size-4" aria-hidden="true" /> : null}</button>)}
      </nav>
      <div className={styles.content}>
        {feedback ? <p role={feedback.error ? "alert" : "status"} className={feedback.error ? styles.error : styles.success}>{feedback.message}</p> : null}
        {!source ? <div role="status"><BentoCardSkeleton lines={4} /></div> : source.error ? <div role="alert" className="grid justify-items-start gap-2">
          <BentoErrorState message={source.error} /><Button type="button" variant="outline" onClick={() => setVersion(value => value + 1)}>Réessayer</Button>
        </div> : null}
        {section === "agency" && data ? <AgencyPanel data={data} mutate={mutate} busy={busy} /> : null}
        {section === "users" && data ? <UsersPanel data={data} mutate={mutate} busy={busy} /> : null}
        {section === "roles" && data ? <RolesPanel data={data} /> : null}
        {section === "notifications" && data?.preferences ? <NotificationsPanel preferences={data.preferences} mutate={mutate} busy={busy} /> : null}
        {section === "integrations" && data ? <IntegrationsPanel data={data} /> : null}
        {section === "data" && data ? <DataPanel data={data} /> : null}
        {section === "security" && data ? <SecurityPanel data={data} onSaved={message => { refresh(message); router.refresh(); }} /> : null}
        {(section === "property-types" || section === "statuses" || section === "sources") && data ? <ReferencesPanel section={section} data={data} /> : null}
      </div>
    </div>
  </section>;
}
