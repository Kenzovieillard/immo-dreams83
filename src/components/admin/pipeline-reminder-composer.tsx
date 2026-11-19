"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Plus } from "lucide-react";
import { PipelineDossierCombobox } from "@/components/admin/pipeline-dossier-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { leadPriorities, leadPriorityLabels } from "@/lib/crm";
import type { AdminTeamMember, LeadPriority, PipelineLead } from "@/types/crm";

type DuplicateTask = {
  id: string;
  title: string;
  dueAt: string | null;
};

type ReminderResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  duplicateTask?: DuplicateTask;
};

function getDefaultDueAt() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function getTeamMemberLabel(member: AdminTeamMember | undefined) {
  return member?.fullName?.trim() || member?.email || "Agent";
}

export function PipelineReminderComposer({
  open,
  onOpenChange,
  leads,
  team,
  initialLeadId,
  connected,
  onSaved,
  onFeedback,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: PipelineLead[];
  team: AdminTeamMember[];
  initialLeadId: string | null;
  connected: boolean;
  onSaved: () => Promise<void>;
  onFeedback: (message: string) => void;
}) {
  const router = useRouter();
  const activeLeads = useMemo(
    () => leads.filter((lead) => !lead.archived && lead.status !== "LOST"),
    [leads]
  );
  const [leadId, setLeadId] = useState<string | null>(initialLeadId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState(getDefaultDueAt);
  const [priority, setPriority] = useState<LeadPriority>("normal");
  const [assignedTo, setAssignedTo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [duplicateTask, setDuplicateTask] = useState<DuplicateTask | null>(null);
  const selectedLead = activeLeads.find((lead) => lead.id === leadId) ?? null;

  useEffect(() => {
    if (!open) return;
    const nextLead =
      activeLeads.find((lead) => lead.id === initialLeadId) ?? activeLeads[0] ?? null;
    const resetId = window.setTimeout(() => {
      setLeadId(nextLead?.id ?? null);
      setAssignedTo(nextLead?.assignedTo ?? team[0]?.id ?? "");
      setTitle("");
      setDescription("");
      setDueAt(getDefaultDueAt());
      setPriority("normal");
      setError("");
      setDuplicateTask(null);
    }, 0);

    return () => window.clearTimeout(resetId);
  }, [activeLeads, initialLeadId, open, team]);

  function selectLead(nextLeadId: string | null) {
    setLeadId(nextLeadId);
    const nextLead = activeLeads.find((lead) => lead.id === nextLeadId) ?? null;
    setAssignedTo(nextLead?.assignedTo ?? team[0]?.id ?? "");
    setDuplicateTask(null);
  }

  async function submit(confirmDuplicate = false) {
    if (!selectedLead || !title.trim() || !dueAt || !assignedTo) {
      setError("Choisissez un dossier, un responsable, un titre et une échéance.");
      return;
    }
    if (!connected) {
      setError("Supabase doit être connecté pour enregistrer un rappel réel.");
      return;
    }

    setPending(true);
    setError("");
    const response = await fetch("/api/admin/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-task",
        leadId: selectedLead.id,
        propertyId: selectedLead.linkedPropertyId,
        title: title.trim(),
        description: description.trim() || null,
        dueAt,
        priority,
        assignedTo,
        taskType: "FOLLOW_UP",
        recurrenceRule: "NONE",
        reminderChannel: "NONE",
        confirmDuplicate,
      }),
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as ReminderResponse | null)
      : null;
    setPending(false);

    if (!response?.ok) {
      if (response?.status === 401) router.push("/admin/login");
      if (response?.status === 409 && payload?.code === "POTENTIAL_DUPLICATE") {
        setDuplicateTask(payload.duplicateTask ?? null);
        setError(payload.message ?? "Un rappel similaire existe déjà.");
        return;
      }
      setError(payload?.message ?? "Le rappel n'a pas pu être enregistré.");
      return;
    }

    await onSaved();
    onFeedback(payload?.message ?? "Rappel créé.");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="crm-riviera !w-screen max-w-none gap-0 bg-[var(--crm-riviera-bg-surface)] sm:!w-[min(94vw,30rem)] sm:!max-w-[30rem]"
        overlayClassName="supports-backdrop-filter:backdrop-blur-none"
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] px-4 py-4 pr-14">
          <SheetTitle className="text-lg font-semibold">Créer un rappel</SheetTitle>
          <SheetDescription>Planifiez une action sur le bon dossier commercial.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          {activeLeads.length ? (
            <div className="grid gap-5">
              <PipelineDossierCombobox
                leads={activeLeads}
                value={leadId}
                onValueChange={selectLead}
                disabled={pending}
              />

              {selectedLead ? (
                <div className="rounded-lg bg-[var(--crm-riviera-bg-accent)] p-3 text-sm">
                  <p className="font-mono text-[10px] text-[var(--crm-riviera-text-secondary)]">
                    {selectedLead.dossierReference}
                  </p>
                  <p className="mt-1 font-semibold text-[var(--crm-riviera-text-primary)]">
                    {selectedLead.contactName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">
                    {selectedLead.requestType} · {selectedLead.city ?? "Ville non renseignée"}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="pipeline-reminder-title">Action à réaliser</Label>
                <Input
                  id="pipeline-reminder-title"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setDuplicateTask(null);
                  }}
                  placeholder="Appeler pour qualifier le projet"
                  maxLength={160}
                  disabled={pending}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pipeline-reminder-due">Échéance</Label>
                <Input
                  id="pipeline-reminder-due"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => {
                    setDueAt(event.target.value);
                    setDuplicateTask(null);
                  }}
                  disabled={pending}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Priorité</Label>
                  <Select value={priority} onValueChange={(value) => setPriority(value as LeadPriority)}>
                    <SelectTrigger aria-label="Priorité du rappel" className="min-h-11">
                      <SelectValue>{(value) => leadPriorityLabels[value as LeadPriority]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {leadPriorities.map((value) => (
                        <SelectItem key={value} value={value}>
                          {leadPriorityLabels[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Responsable</Label>
                  <Select value={assignedTo} onValueChange={(value) => setAssignedTo(String(value))}>
                    <SelectTrigger aria-label="Responsable du rappel" className="min-h-11">
                      <SelectValue>
                        {(value) => getTeamMemberLabel(team.find((member) => member.id === value))}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {team.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {getTeamMemberLabel(member)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pipeline-reminder-comment">Commentaire</Label>
                <Textarea
                  id="pipeline-reminder-comment"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Contexte utile pour Antoine ou Michel"
                  maxLength={2000}
                  disabled={pending}
                  className="min-h-24"
                />
              </div>

              {error ? (
                <div
                  role="alert"
                  className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">{error}</p>
                    {duplicateTask ? (
                      <p className="mt-1 text-xs">
                        {duplicateTask.title}
                        {duplicateTask.dueAt
                          ? ` · ${new Date(duplicateTask.dueAt).toLocaleString("fr-FR")}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg bg-[var(--crm-riviera-bg-accent)] px-4 py-8 text-center">
              <CalendarClock className="mx-auto size-6 text-[var(--crm-riviera-text-action)]" />
              <p className="mt-3 font-semibold text-[var(--crm-riviera-text-primary)]">
                Aucun dossier actif
              </p>
            </div>
          )}
        </div>

        <SheetFooter className="sticky bottom-0 z-10 mt-0 border-t border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] px-4 py-4 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button
            type="button"
            disabled={!selectedLead || !title.trim() || !dueAt || !assignedTo || pending}
            onClick={() => void submit(Boolean(duplicateTask))}
            className="bg-[var(--crm-riviera-bg-action)] text-white hover:bg-[var(--crm-riviera-bg-header)]"
          >
            {duplicateTask ? <AlertTriangle className="size-4" /> : <Plus className="size-4" />}
            {pending
              ? "Enregistrement..."
              : duplicateTask
                ? "Créer malgré le doublon"
                : "Enregistrer le rappel"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
