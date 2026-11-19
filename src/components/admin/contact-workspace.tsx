"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CommercialDialog } from "@/components/commercial/commercial-design-ui";
import { commercialLabel } from "@/lib/commercial-presentation";
import type { ContactAction } from "@/lib/contact-rules";
import type { ContactWorkspace } from "@/types/contact-workspace";
import type { AdminTeamMember } from "@/types/crm";
import {
  RivieraPanel,
  RivieraStatusBadge,
  rivieraPrimaryButtonClass,
} from "./crm-riviera-ui";

const date = (value: string) =>
  new Date(value).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });
const money = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

export function useContactWorkspace(id: string, enabled: boolean) {
  const [data, setData] = useState<ContactWorkspace | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void fetch(`/api/admin/contacts/${id}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success)
          throw new Error(payload.message ?? "Chargement impossible.");
        if (!controller.signal.aborted) {
          setData(payload.data);
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "Erreur réseau.");
      });
    return () => controller.abort();
  }, [id, enabled, revision]);
  async function act(action: ContactAction) {
    if (!enabled || pending) return false;
    setPending(true);
    try {
      const response = await fetch(`/api/admin/contacts/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success)
        throw new Error(payload.message ?? "Enregistrement impossible.");
      setError("");
      reload();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erreur réseau.");
      return false;
    } finally {
      setPending(false);
    }
  }
  return { data, error, pending, reload, act, enabled };
}
export type ContactWorkspaceState = ReturnType<typeof useContactWorkspace>;

export function ContactProjects({
  state,
  canWrite,
  description,
  budget,
}: {
  state: ContactWorkspaceState;
  canWrite: boolean;
  description: string;
  budget: number | null;
}) {
  const [editing, setEditing] = useState<
    ContactWorkspace["projects"][number] | null
  >(null);
  return (
    <RivieraPanel className="grid gap-4 p-5 sm:p-6">
      <h3 className="text-lg font-semibold">Détails de la recherche</h3>
      <ContactWorkspaceStatus state={state} />
      {state.data?.projects.map((project) => (
        <article key={project.id} className="grid gap-3 rounded-xl border p-4">
          <div className="flex flex-wrap justify-between gap-3">
            <h4 className="font-semibold">{project.title}</h4>
            {canWrite && (
              <Button variant="outline" onClick={() => setEditing(project)}>
                Modifier le projet
              </Button>
            )}
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[#66716c]">Type de projet</dt>
              <dd className="mt-1 font-semibold">
                {commercialLabel(project.project_type ?? "À préciser")}
              </dd>
            </div>
            <div>
              <dt className="text-[#66716c]">Budget</dt>
              <dd className="mt-1 font-semibold">
                {project.budget_min == null && project.budget_max == null
                  ? "À préciser"
                  : `${project.budget_min == null ? "Non précisé" : money(project.budget_min)} — ${project.budget_max == null ? "Non précisé" : money(project.budget_max)}`}
              </dd>
            </div>
            <div>
              <dt className="text-[#66716c]">Financement déclaré</dt>
              <dd className="mt-1 font-semibold">
                {project.financing_approved ? "Validé" : "Non validé"}
              </dd>
            </div>
            <div>
              <dt className="text-[#66716c]">Secteurs souhaités</dt>
              <dd className="mt-1 font-semibold">
                {project.city || "À préciser"}
              </dd>
            </div>
          </dl>
          <p className="whitespace-pre-wrap text-sm text-[#66716c]">
            {project.notes || description || "Critères à préciser"}
          </p>
        </article>
      ))}
      {state.data && !state.data.projects.length && (
        <div className="grid gap-3 text-sm">
          <p className="whitespace-pre-wrap">
            {description || "Projet à préciser"}
          </p>
          <p>Budget estimé : {budget == null ? "À préciser" : money(budget)}</p>
          <p className="text-[#66716c]">
            Qualifiez le contact puis créez son dossier avec « Créer un prospect
            » pour renseigner son budget détaillé et son financement.
          </p>
        </div>
      )}
      {editing && (
        <CommercialDialog
          title="Modifier le projet"
          onClose={() => setEditing(null)}
        >
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const amount = (key: string) =>
                String(form.get(key) ?? "") === ""
                  ? null
                  : Number(form.get(key));
              if (
                await state.act({
                  action: "update-project",
                  projectId: editing.id,
                  budgetMin: amount("min"),
                  budgetMax: amount("max"),
                  city: String(form.get("city")),
                  notes: String(form.get("notes")),
                  financingApproved: form.get("financing") === "on",
                })
              )
                setEditing(null);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                Budget minimum (€)
                <Input
                  type="number"
                  min="0"
                  name="min"
                  defaultValue={editing.budget_min ?? ""}
                />
              </label>
              <label className="grid gap-2">
                Budget maximum (€)
                <Input
                  type="number"
                  min="0"
                  name="max"
                  defaultValue={editing.budget_max ?? ""}
                />
              </label>
            </div>
            <label className="grid gap-2">
              Secteurs souhaités
              <Input
                name="city"
                maxLength={250}
                defaultValue={editing.city ?? ""}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                name="financing"
                type="checkbox"
                defaultChecked={editing.financing_approved}
              />
              Financement validé (déclaration du conseiller)
            </label>
            <label className="grid gap-2">
              Critères et notes du projet
              <Textarea
                name="notes"
                maxLength={4000}
                defaultValue={editing.notes ?? ""}
              />
            </label>
            <ContactWorkspaceStatus state={state} />
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={state.pending}>
                Enregistrer le projet
              </Button>
            </div>
          </form>
        </CommercialDialog>
      )}
    </RivieraPanel>
  );
}

export function ContactWorkspaceStatus({
  state,
}: {
  state: ContactWorkspaceState;
}) {
  if (!state.enabled)
    return (
      <p role="status">
        Connexion à Supabase nécessaire pour les données liées.
      </p>
    );
  if (state.error)
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"
      >
        {state.error}
        <Button
          type="button"
          variant="outline"
          onClick={state.reload}
          className="ml-3"
        >
          Réessayer
        </Button>
      </div>
    );
  if (!state.data)
    return (
      <p
        role="status"
        className="animate-pulse rounded-xl bg-[#dce5d7] p-4 text-sm"
      >
        Chargement des données liées…
      </p>
    );
  return null;
}

export function ContactTaskDialog({
  state,
  team,
  assignedTo,
  canAssign,
  onClose,
}: {
  state: ContactWorkspaceState;
  team: AdminTeamMember[];
  assignedTo: string | null;
  canAssign: boolean;
  onClose: () => void;
}) {
  return (
    <CommercialDialog title="Créer une tâche" onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          const ok = await state.act({
            action: "create-task",
            title: String(values.get("title")),
            description: String(values.get("description")),
            dueAt: new Date(String(values.get("dueAt"))).toISOString(),
            assignedTo:
              String(values.get("assignedTo") ?? assignedTo ?? "") || null,
          });
          if (ok) onClose();
        }}
      >
        <label className="grid gap-2 text-sm">
          Objet
          <Input
            name="title"
            required
            minLength={2}
            maxLength={200}
            autoFocus
          />
        </label>
        <label className="grid gap-2 text-sm">
          Échéance (heure locale)
          <Input name="dueAt" type="datetime-local" required />
        </label>
        {canAssign && (
          <label className="grid gap-2 text-sm">
            Responsable
            <select
              name="assignedTo"
              defaultValue={assignedTo ?? ""}
              className="min-h-11 rounded-lg border bg-white px-3"
            >
              <option value="">Responsable du contact</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName ?? member.email}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-2 text-sm">
          Description
          <Textarea name="description" maxLength={4000} />
        </label>
        <ContactWorkspaceStatus state={state} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={state.pending}
            className={rivieraPrimaryButtonClass}
          >
            {state.pending ? "Enregistrement…" : "Créer la tâche"}
          </Button>
        </div>
      </form>
    </CommercialDialog>
  );
}

export function ContactTasks({
  state,
  canWrite,
  onCreate,
}: {
  state: ContactWorkspaceState;
  canWrite: boolean;
  onCreate: () => void;
}) {
  const tasks =
    state.data?.tasks.filter((task) => task.status !== "CANCELLED") ?? [];
  return (
    <RivieraPanel className="grid gap-4 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Prochaines actions</h3>
        {canWrite && (
          <button
            type="button"
            onClick={onCreate}
            aria-label="Créer une tâche"
            className="grid size-10 place-items-center rounded-lg border"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
      <ContactWorkspaceStatus state={state} />
      {state.data && !tasks.length && (
        <p className="text-sm text-[#66716c]">
          Aucune tâche enregistrée pour ce contact.
        </p>
      )}
      {tasks.map((task) => (
        <label key={task.id} className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-[#2f493a]"
            checked={!!task.completed_at}
            disabled={!canWrite || state.pending}
            onChange={(event) =>
              void state.act({
                action: "complete-task",
                taskId: task.id,
                completed: event.target.checked,
              })
            }
          />
          <span>
            <span
              className={
                task.completed_at
                  ? "line-through text-[#66716c]"
                  : "font-semibold"
              }
            >
              {task.title}
            </span>
            <span className="mt-1 block text-xs text-[#66716c]">
              {task.due_at ? date(task.due_at) : "Sans échéance"}
            </span>
          </span>
        </label>
      ))}
    </RivieraPanel>
  );
}

export function ContactActivities({
  state,
  canWrite,
}: {
  state: ContactWorkspaceState;
  canWrite: boolean;
}) {
  const [filter, setFilter] = useState("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const entries = state.data?.activities ?? [];
  const kind = (entry: (typeof entries)[number]) => {
    const metadata =
      entry.metadata &&
      typeof entry.metadata === "object" &&
      !Array.isArray(entry.metadata)
        ? entry.metadata
        : {};
    return String(
      metadata.kind ??
        (/appel/i.test(entry.action)
          ? "CALL"
          : /visite/i.test(entry.action)
            ? "VISIT"
            : /email|mail/i.test(entry.action)
              ? "EMAIL"
              : "OTHER"),
    );
  };
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <RivieraPanel className="grid gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Historique des échanges</h3>
          {canWrite && (
            <Button variant="outline" onClick={() => setFormOpen(true)}>
              Consigner un échange
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["ALL", "Tous"],
            ["CALL", "Appels"],
            ["EMAIL", "Emails"],
            ["VISIT", "Visites"],
            ["NOTE", "Notes"],
          ].map(([value, label]) => (
            <Button
              key={value}
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {label}
            </Button>
          ))}
        </div>
        <ContactWorkspaceStatus state={state} />
        {entries
          .filter((entry) => filter === "ALL" || kind(entry) === filter)
          .map((entry) => {
            const metadata =
              entry.metadata &&
              typeof entry.metadata === "object" &&
              !Array.isArray(entry.metadata)
                ? entry.metadata
                : {};
            return (
              <article
                key={entry.id}
                className="border-l-2 border-[#dce5d7] pl-4"
              >
                <p className="text-sm font-semibold">{entry.action}</p>
                {typeof metadata.description === "string" && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#66716c]">
                    {metadata.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-[#66716c]">
                  {date(entry.created_at)} · {entry.user_name}
                </p>
              </article>
            );
          })}
        {state.data &&
          !entries.some(
            (entry) => filter === "ALL" || kind(entry) === filter,
          ) && (
            <p className="text-sm text-[#66716c]">
              Aucun échange correspondant.
            </p>
          )}
      </RivieraPanel>
      <RivieraPanel className="grid gap-4 p-5 sm:p-6">
        <h3 className="text-lg font-semibold">Statistiques d’activité</h3>
        <p className="text-xs text-[#66716c]">
          Échanges consignés ce mois-ci, parmi les 500 derniers événements
          chargés. Consigner un email ne l’envoie pas.
        </p>
        {[
          ["CALL", "Appels"],
          ["EMAIL", "Emails consignés"],
          ["VISIT", "Visites"],
          ["NOTE", "Notes"],
        ].map(([value, label]) => (
          <div
            key={value}
            className="flex justify-between border-b pb-2 text-sm"
          >
            <span>{label}</span>
            <strong>
              {
                entries.filter(
                  (entry) =>
                    kind(entry) === value &&
                    new Date(entry.created_at).toLocaleDateString("en-CA", {
                      year: "numeric",
                      month: "2-digit",
                      timeZone: "Europe/Paris",
                    }) ===
                      new Date().toLocaleDateString("en-CA", {
                        year: "numeric",
                        month: "2-digit",
                        timeZone: "Europe/Paris",
                      }),
                ).length
              }
            </strong>
          </div>
        ))}
      </RivieraPanel>
      {formOpen && (
        <CommercialDialog
          title="Consigner un échange"
          onClose={() => setFormOpen(false)}
        >
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              if (
                await state.act({
                  action: "log-activity",
                  kind: String(values.get("kind")) as "CALL",
                  description: String(values.get("description")),
                })
              )
                setFormOpen(false);
            }}
          >
            <label className="grid gap-2">
              Type
              <select
                name="kind"
                className="min-h-11 rounded-lg border bg-white px-3"
              >
                <option value="CALL">Appel</option>
                <option value="EMAIL">Email déjà envoyé</option>
                <option value="NOTE">Note</option>
                <option value="MEETING">Rendez-vous</option>
              </select>
            </label>
            <label className="grid gap-2">
              Compte rendu
              <Textarea
                name="description"
                required
                minLength={2}
                maxLength={4000}
              />
            </label>
            <ContactWorkspaceStatus state={state} />
            <Button disabled={state.pending} type="submit">
              Enregistrer l’échange
            </Button>
          </form>
        </CommercialDialog>
      )}
    </div>
  );
}

export function ContactRelated({
  state,
  tab,
  contactId,
  canWrite,
}: {
  state: ContactWorkspaceState;
  tab: "properties" | "visits" | "documents";
  contactId: string;
  canWrite: boolean;
}) {
  const [downloadError, setDownloadError] = useState("");
  async function download(id: string) {
    setDownloadError("");
    try {
      const response = await fetch(
        `/api/admin/commercial/offres?documentId=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok || !payload.success)
        throw new Error(payload.message ?? "Téléchargement impossible.");
      const target = new URL(payload.url);
      if (target.protocol !== "https:")
        throw new Error("Lien de téléchargement invalide.");
      window.location.assign(target.href);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Téléchargement impossible.",
      );
    }
  }
  return (
    <RivieraPanel className="grid gap-5 p-5 sm:p-6">
      <h3 className="text-lg font-semibold">
        {tab === "properties"
          ? "Biens liés au contact"
          : tab === "visits"
            ? "Visites du contact"
            : "Documents des offres et négociations"}
      </h3>
      <ContactWorkspaceStatus state={state} />
      {tab === "properties" && (
        <>
          {state.data?.properties.map((property) => (
            <article
              key={property.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div>
                <Link
                  className="font-semibold underline"
                  href={`/admin?tab=properties&property=${property.id}`}
                >
                  {property.title}
                </Link>
                <p className="text-sm text-[#66716c]">
                  {property.city} · Réf. {property.reference}
                </p>
              </div>
              <strong>
                {property.price == null
                  ? "Prix à préciser"
                  : money(property.price)}
              </strong>
              <RivieraStatusBadge>
                {commercialLabel(property.status)}
              </RivieraStatusBadge>
              <Link
                href={
                  canWrite
                    ? `/commercial/visites/nouvelle?contact_id=${contactId}&bien=${property.id}`
                    : "/commercial/visites"
                }
                className="text-sm underline"
              >
                {canWrite
                  ? "Planifier une visite"
                  : "Consulter le module Visites"}
              </Link>
            </article>
          ))}
          {state.data && !state.data.properties.length && (
            <p className="text-sm text-[#66716c]">
              Aucun bien associé à un dossier ou une visite de ce contact.
            </p>
          )}
        </>
      )}
      {tab === "visits" && (
        <>
          {canWrite && (
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold underline"
              href={`/admin?tab=agenda&create=VISIT&agendaContact=${contactId}`}
            >
              <CalendarDays className="size-4" />
              Planifier une visite
            </Link>
          )}
          {state.data?.visits.map((visit) => (
            <article
              key={visit.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div>
                <Link
                  href={`/commercial/visites/${visit.id}`}
                  className="font-semibold underline"
                >
                  {visit.title}
                </Link>
                <p className="mt-1 text-sm text-[#66716c]">
                  {date(visit.starts_at)}
                </p>
              </div>
              <RivieraStatusBadge>
                {commercialLabel(visit.visit_status)}
              </RivieraStatusBadge>
              {visit.interest_level != null && (
                <span className="text-sm">
                  Intérêt déclaré : {visit.interest_level}/5
                </span>
              )}
            </article>
          ))}
          {state.data && !state.data.visits.length && (
            <p className="text-sm text-[#66716c]">
              Aucune visite enregistrée pour ce contact.
            </p>
          )}
        </>
      )}
      {tab === "documents" && (
        <>
          {downloadError && (
            <p role="alert" className="text-red-700">
              {downloadError}
            </p>
          )}
          {state.data?.documents.map((document) => (
            <article
              key={`${document.kind}-${document.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div>
                <p className="font-semibold">{document.fileName}</p>
                <p className="text-xs text-[#66716c]">
                  {date(document.createdAt)} · Document privé
                </p>
              </div>
              {document.kind === "offer" ? (
                <Button
                  variant="outline"
                  onClick={() => void download(document.id)}
                >
                  Télécharger
                </Button>
              ) : (
                <Link
                  className="text-sm underline"
                  href={`/commercial/negociations/${document.parentId}`}
                >
                  Ouvrir la négociation
                </Link>
              )}
            </article>
          ))}
          {state.data && !state.data.documents.length && (
            <p className="text-sm text-[#66716c]">
              Aucun document d’offre ou de négociation accessible pour ce
              contact. Les fichiers se gèrent depuis leur dossier commercial.
            </p>
          )}
        </>
      )}
    </RivieraPanel>
  );
}
