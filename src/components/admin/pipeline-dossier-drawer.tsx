"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, FileSignature, Mail, MapPin, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  commercialOfferStatusLabels,
  leadPriorityLabels,
  leadStatusLabels,
  leadStatuses,
} from "@/lib/crm";
import type {
  AdminTeamMember,
  CommercialOffer,
  CommercialOfferStatus,
  LeadStatus,
  PipelineLead,
  PipelinePermissions,
  PipelineTask,
} from "@/types/crm";

function getTeamMemberLabel(member: AdminTeamMember | undefined) {
  return member?.fullName?.trim() || member?.email || "Agent";
}

function formatDateTime(value: string | null) {
  if (!value) return "Sans échéance";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sans échéance" : date.toLocaleString("fr-FR");
}

function formatBudget(lead: PipelineLead) {
  const formatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  if (lead.budgetMin && lead.budgetMax) return `${formatter.format(lead.budgetMin)} - ${formatter.format(lead.budgetMax)}`;
  if (lead.budgetMax) return `Jusqu'à ${formatter.format(lead.budgetMax)}`;
  if (lead.budgetMin) return `À partir de ${formatter.format(lead.budgetMin)}`;
  return "Budget non renseigné";
}

function getNextOfferStatus(status: CommercialOfferStatus): CommercialOfferStatus | null {
  if (status === "DRAFT") return "TO_BE_SIGNED";
  if (status === "TO_BE_SIGNED") return "SIGNED_BY_BUYER";
  if (status === "SIGNED_BY_BUYER") return "SENT_TO_SELLER";
  if (status === "SENT_TO_SELLER") return "NEGOTIATING";
  if (status === "EXPIRED") return "DRAFT";
  return null;
}

export function PipelineDossierDrawer({
  lead,
  open,
  onOpenChange,
  tasks,
  offers,
  team,
  permissions,
  pending,
  onUpdateLead,
  onCreateReminder,
  onCreateOffer,
  onUpdateOfferStatus,
}: {
  lead: PipelineLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: PipelineTask[];
  offers: CommercialOffer[];
  team: AdminTeamMember[];
  permissions: PipelinePermissions;
  pending: boolean;
  onUpdateLead: (lead: PipelineLead, updates: Partial<PipelineLead>) => Promise<void>;
  onCreateReminder: (leadId: string) => void;
  onCreateOffer: (lead: PipelineLead) => void;
  onUpdateOfferStatus: (
    offer: CommercialOffer,
    status: CommercialOfferStatus,
    options?: { reason?: string; confirmPropertyUnderOffer?: boolean }
  ) => Promise<void>;
}) {
  const [decisionOfferId, setDecisionOfferId] = useState<string | null>(null);
  const [decisionStatus, setDecisionStatus] = useState<CommercialOfferStatus | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [confirmPropertyUnderOffer, setConfirmPropertyUnderOffer] = useState(false);
  const leadTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.leadId === lead?.id && !task.completedAt && task.status !== "CANCELLED")
        .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999")),
    [lead?.id, tasks]
  );
  const leadOffers = useMemo(
    () => offers.filter((offer) => offer.buyerDossierId === lead?.id),
    [lead?.id, offers]
  );

  useEffect(() => {
    const resetId = window.setTimeout(() => {
      setDecisionOfferId(null);
      setDecisionStatus(null);
      setDecisionReason("");
      setConfirmPropertyUnderOffer(false);
    }, 0);

    return () => window.clearTimeout(resetId);
  }, [lead?.id, open]);

  if (!lead) return null;

  function startDecision(offerId: string, status: CommercialOfferStatus) {
    setDecisionOfferId(offerId);
    setDecisionStatus(status);
    setDecisionReason("");
    setConfirmPropertyUnderOffer(false);
  }

  async function confirmDecision(offer: CommercialOffer) {
    if (!decisionStatus) return;
    await onUpdateOfferStatus(offer, decisionStatus, {
      reason: decisionReason.trim() || undefined,
      confirmPropertyUnderOffer: decisionStatus === "ACCEPTED" && confirmPropertyUnderOffer,
    });
    setDecisionOfferId(null);
    setDecisionStatus(null);
    setDecisionReason("");
    setConfirmPropertyUnderOffer(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="crm-riviera !w-screen max-w-none gap-0 bg-[var(--crm-riviera-bg-surface)] sm:!w-[min(94vw,32rem)] sm:!max-w-[32rem]"
        overlayClassName="supports-backdrop-filter:backdrop-blur-none"
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] px-4 py-4 pr-14">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-lg font-semibold">{lead.contactName}</SheetTitle>
            <span className="font-mono text-[10px] text-[var(--crm-riviera-text-secondary)]">
              {lead.dossierReference}
            </span>
          </div>
          <SheetDescription>{lead.requestType} · {lead.city ?? "Ville non renseignée"}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="grid gap-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[var(--crm-riviera-bg-accent)] p-3">
                <p className="text-xs text-[var(--crm-riviera-text-secondary)]">Étape</p>
                <p className="mt-1 font-semibold text-[var(--crm-riviera-text-primary)]">
                  {lead.hasActiveOffer ? "Offre" : lead.hasActiveAppointment ? "Rendez-vous" : leadStatusLabels[lead.status]}
                </p>
              </div>
              <div className="rounded-lg bg-[var(--crm-riviera-bg-accent)] p-3">
                <p className="text-xs text-[var(--crm-riviera-text-secondary)]">Priorité</p>
                <p className="mt-1 font-semibold text-[var(--crm-riviera-text-primary)]">
                  {leadPriorityLabels[lead.priority]}
                </p>
              </div>
            </div>

            <section className="rounded-lg border border-[var(--crm-riviera-border-default)] p-4">
              <h3 className="text-xs font-semibold uppercase text-[var(--crm-riviera-text-secondary)]">Contact</h3>
              <div className="mt-3 grid gap-2 text-sm text-[var(--crm-riviera-text-primary)]">
                {lead.contactEmail ? (
                  <a href={`mailto:${lead.contactEmail}`} className="flex min-w-0 items-center gap-2 font-medium text-[var(--crm-riviera-text-action)]">
                    <Mail className="size-4 shrink-0" />
                    <span className="truncate">{lead.contactEmail}</span>
                  </a>
                ) : null}
                {lead.contactPhone ? (
                  <a href={`tel:${lead.contactPhone}`} className="flex min-w-0 items-center gap-2 font-medium text-[var(--crm-riviera-text-action)]">
                    <Phone className="size-4 shrink-0" />
                    <span className="truncate">{lead.contactPhone}</span>
                  </a>
                ) : null}
                {!lead.contactEmail && !lead.contactPhone ? (
                  <p className="text-[var(--crm-riviera-text-secondary)]">Aucun moyen de contact renseigné.</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-lg border border-[var(--crm-riviera-border-default)] p-4">
              <h3 className="text-xs font-semibold uppercase text-[var(--crm-riviera-text-secondary)]">Projet</h3>
              <p className="mt-2 font-semibold text-[var(--crm-riviera-text-primary)]">{lead.requestType}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-[var(--crm-riviera-text-secondary)]">
                <MapPin className="size-4 shrink-0" />
                {lead.city ?? "Secteur non renseigné"}{lead.postalCode ? ` · ${lead.postalCode}` : ""}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[var(--crm-riviera-text-secondary)]">
                <p><span className="block font-semibold text-[var(--crm-riviera-text-primary)]">Budget</span>{formatBudget(lead)}</p>
                <p><span className="block font-semibold text-[var(--crm-riviera-text-primary)]">Critères</span>{lead.desiredSurface ? `${lead.desiredSurface} m²` : "Surface libre"}{lead.desiredRooms ? ` · ${lead.desiredRooms} pièces` : ""}</p>
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Responsable</Label>
                <Select
                  value={lead.assignedTo ?? "UNASSIGNED"}
                  disabled={!permissions.canAssignDossiers || pending}
                  onValueChange={(value) =>
                    void onUpdateLead(lead, { assignedTo: value === "UNASSIGNED" ? null : String(value) })
                  }
                >
                  <SelectTrigger aria-label="Responsable du dossier" className="min-h-11">
                    <SelectValue>
                      {(value) =>
                        value === "UNASSIGNED"
                          ? "Non attribué"
                          : getTeamMemberLabel(team.find((member) => member.id === value))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNASSIGNED">Non attribué</SelectItem>
                    {team.map((member) => (
                      <SelectItem key={member.id} value={member.id}>{getTeamMemberLabel(member)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Statut du dossier</Label>
                <Select
                  value={lead.status}
                  disabled={pending}
                  onValueChange={(value) => void onUpdateLead(lead, { status: value as LeadStatus })}
                >
                  <SelectTrigger aria-label="Statut du dossier" className="min-h-11">
                    <SelectValue>{(value) => leadStatusLabels[value as LeadStatus]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {leadStatuses.map((value) => (
                      <SelectItem key={value} value={value}>{leadStatusLabels[value]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <section className="rounded-lg border border-[var(--crm-riviera-border-default)] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase text-[var(--crm-riviera-text-secondary)]">
                  Prochaines actions
                </h3>
                <span className="text-xs text-[var(--crm-riviera-text-secondary)]">{leadTasks.length}</span>
              </div>
              {leadTasks.length ? (
                <div className="mt-3 grid gap-3">
                  {leadTasks.slice(0, 4).map((task) => (
                    <div key={task.id} className="grid grid-cols-[auto_1fr] gap-3 border-t border-[var(--crm-riviera-border-default)] pt-3 first:border-0 first:pt-0">
                      <CalendarClock className="mt-0.5 size-4 text-[var(--crm-riviera-text-action)]" />
                      <div>
                        <p className="font-semibold text-[var(--crm-riviera-text-primary)]">{task.title}</p>
                        <p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">{formatDateTime(task.dueAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--crm-riviera-text-secondary)]">Aucune action planifiée.</p>
              )}
            </section>

            <section className="rounded-lg border border-[var(--crm-riviera-border-default)] p-4">
              <h3 className="text-xs font-semibold uppercase text-[var(--crm-riviera-text-secondary)]">Bien et visite</h3>
              <p className="mt-2 font-semibold text-[var(--crm-riviera-text-primary)]">
                {lead.linkedPropertyTitle ?? "Aucun bien lié au dossier"}
              </p>
              <p className="mt-2 text-xs text-[var(--crm-riviera-text-secondary)]">
                {lead.hasActiveAppointment ? "Une visite active est liée à ce dossier." : "Aucune visite active."}
              </p>
            </section>

            <section className="rounded-lg border border-[var(--crm-riviera-border-default)] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase text-[var(--crm-riviera-text-secondary)]">Offres</h3>
                <span className="text-xs text-[var(--crm-riviera-text-secondary)]">{leadOffers.length}</span>
              </div>
              {leadOffers.length ? (
                <div className="mt-3 grid gap-3">
                  {leadOffers.map((offer) => {
                    const nextStatus = getNextOfferStatus(offer.status);
                    const decisionOpen = decisionOfferId === offer.id && Boolean(decisionStatus);
                    return (
                      <article key={offer.id} className="rounded-lg bg-[var(--crm-riviera-bg-accent)] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[var(--crm-riviera-text-primary)]">
                              {offer.amount.toLocaleString("fr-FR")} €
                            </p>
                            <p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">
                              {offer.propertyReference ? `Réf. ${offer.propertyReference} · ` : ""}{offer.propertyTitle}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[var(--crm-riviera-text-action)]">
                            {commercialOfferStatusLabels[offer.status]}
                          </span>
                        </div>
                        <p className="mt-3 text-xs font-medium text-[var(--crm-riviera-text-primary)]">{offer.nextAction}</p>
                        <p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">{formatDateTime(offer.nextActionDueAt)}</p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {nextStatus ? (
                            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void onUpdateOfferStatus(offer, nextStatus)}>
                              {commercialOfferStatusLabels[nextStatus]}
                            </Button>
                          ) : null}
                          {permissions.canDecideOffers && (offer.status === "SENT_TO_SELLER" || offer.status === "NEGOTIATING") ? (
                            <>
                              <Button type="button" size="sm" disabled={pending} onClick={() => startDecision(offer.id, "ACCEPTED")}>
                                Accepter
                              </Button>
                              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => startDecision(offer.id, "REJECTED")}>
                                Refuser
                              </Button>
                            </>
                          ) : null}
                          {["DRAFT", "TO_BE_SIGNED", "SIGNED_BY_BUYER", "SENT_TO_SELLER", "NEGOTIATING"].includes(offer.status) ? (
                            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => startDecision(offer.id, "WITHDRAWN")}>
                              Retirer
                            </Button>
                          ) : null}
                        </div>

                        {decisionOpen ? (
                          <div className="mt-3 grid gap-3 border-t border-[var(--crm-riviera-border-default)] pt-3">
                            {decisionStatus === "REJECTED" || decisionStatus === "WITHDRAWN" ? (
                              <div className="grid gap-2">
                                <Label htmlFor={`offer-decision-${offer.id}`}>Raison</Label>
                                <Textarea id={`offer-decision-${offer.id}`} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} className="min-h-20 bg-white" />
                              </div>
                            ) : null}
                            {decisionStatus === "ACCEPTED" ? (
                              <label className="flex items-start gap-3 text-sm text-[var(--crm-riviera-text-primary)]">
                                <input type="checkbox" checked={confirmPropertyUnderOffer} onChange={(event) => setConfirmPropertyUnderOffer(event.target.checked)} className="mt-0.5 size-4 accent-[var(--crm-riviera-bg-action)]" />
                                Passer le bien à « Sous offre » après cette confirmation
                              </label>
                            ) : null}
                            <div className="flex gap-2">
                              <Button type="button" size="sm" disabled={pending || ((decisionStatus === "REJECTED" || decisionStatus === "WITHDRAWN") && !decisionReason.trim())} onClick={() => void confirmDecision(offer)}>
                                Confirmer
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => { setDecisionOfferId(null); setDecisionStatus(null); }}>
                                Annuler
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--crm-riviera-text-secondary)]">Aucune offre enregistrée.</p>
              )}
            </section>

          </div>
        </div>

        <SheetFooter className="sticky bottom-0 z-10 mt-0 grid grid-cols-2 gap-2 border-t border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] px-4 py-4">
          <Button type="button" variant="outline" onClick={() => onCreateReminder(lead.id)}>
            <Plus className="size-4" />
            Rappel
          </Button>
          <Button type="button" disabled={!permissions.canCreateOffers} onClick={() => onCreateOffer(lead)} className="bg-[var(--crm-riviera-bg-action)] text-white hover:bg-[var(--crm-riviera-bg-header)]">
            <FileSignature className="size-4" />
            Offre
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
