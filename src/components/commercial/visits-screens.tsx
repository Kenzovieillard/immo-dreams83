"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  MapPin,
  MessageSquareText,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Star,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { visitFixtures, type VisitData } from "./commercial-data";
import {
  AgentAvatar,
  CommercialBadge,
  CommercialFeedback,
  CommercialPageHeader,
  CommercialPanel,
  DataSourceNotice,
  FieldLabel,
  commercialPrimaryButton,
  commercialSecondaryButton,
  fieldClass,
} from "./commercial-ui";

function visitTone(status: VisitData["status"]): "success" | "warning" | "danger" | "neutral" {
  if (status === "Confirmée" || status === "Réalisée") return "success";
  if (status === "À confirmer") return "warning";
  if (status === "Annulée") return "danger";
  return "neutral";
}

const visitTabs = ["Toutes", "Aujourd'hui", "À venir", "Passées", "Annulées"] as const;

export function VisitsListScreen() {
  const [activeTab, setActiveTab] = useState<(typeof visitTabs)[number]>("Toutes");
  const [search, setSearch] = useState("");
  const rows = useMemo(
    () =>
      visitFixtures.filter((visit) => {
        const matchesTab =
          activeTab === "Toutes" ||
          visit.group === activeTab ||
          (activeTab === "Annulées" && visit.status === "Annulée");
        return matchesTab && `${visit.title} ${visit.location} ${visit.buyer}`.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr"));
      }),
    [activeTab, search],
  );

  return (
    <div className="grid gap-7">
      <CommercialPageHeader
        title="Visites"
        description="Planification, suivi et comptes rendus de visites"
        action={
          <>
            <Link href="/commercial/visites/calendrier" className={commercialSecondaryButton}>
              <CalendarDays className="size-4" /> Vue calendrier
            </Link>
            <Link href="/commercial/visites/demo-visit-1" className={commercialPrimaryButton}>
              <Plus className="size-4" /> Planifier une visite
            </Link>
          </>
        }
      />
      <div className="flex justify-end"><DataSourceNotice /></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Aujourd'hui", "2", "2 confirmées"],
          ["À venir cette semaine", "6", "2 à confirmer"],
          ["Comptes rendus à faire", "3", "Action requise"],
          ["Taux de présence", "92%", "+4% ce mois"],
        ].map(([label, value, detail], index) => (
          <CommercialPanel key={label} className="p-4">
            <div className="flex items-start justify-between"><p className="text-xs text-[#66706b]">{label}</p><span className={cn("size-2 rounded-full", index === 2 ? "bg-[#a94d43]" : index === 3 ? "bg-[#4d7a5c]" : "bg-[#c28b2c]")} /></div>
            <p className="mt-3 text-3xl font-bold">{value}</p><p className="mt-1 text-[11px] text-[#707a75]">{detail}</p>
          </CommercialPanel>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {visitTabs.map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={cn("shrink-0 rounded-full border px-4 py-2 text-xs font-semibold", activeTab === tab ? "border-[#17221e] bg-[#17221e] text-white" : "border-[#dfddd4] bg-[#fbfaf7]")}>{tab}</button>
        ))}
      </div>
      <CommercialPanel className="p-3">
        <div className="grid gap-2 md:grid-cols-[minmax(260px,1fr)_repeat(3,minmax(140px,.45fr))]">
          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#75807a]" /><input value={search} onChange={(event) => setSearch(event.target.value)} className={cn(fieldClass, "min-h-9 pl-10")} placeholder="Rechercher une visite..." aria-label="Rechercher une visite" /></div>
          {["Conseiller : Tous", "Statut : Tous", "Période : Toutes"].map((label) => <button key={label} type="button" className="flex min-h-9 items-center justify-between rounded-lg border border-[#dfddd4] px-3 text-xs">{label}<ChevronDown className="size-3.5" /></button>)}
        </div>
      </CommercialPanel>
      <div className="grid gap-7">
        {(["Aujourd'hui", "À venir", "Passées"] as const).map((group) => {
          const groupRows = rows.filter((visit) => visit.group === group);
          if (!groupRows.length) return null;
          return <section key={group} className="grid gap-3"><h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[#59645f]">{group} <span className="ml-1 rounded-full bg-[#e4e8df] px-2 py-0.5">{groupRows.length}</span></h2>{groupRows.map((visit) => <VisitRow key={visit.id} visit={visit} />)}</section>;
        })}
      </div>
      {!rows.length ? <CommercialPanel className="p-12 text-center"><CalendarDays className="mx-auto size-8 text-[#89918d]" /><p className="mt-3 text-sm font-semibold">Aucune visite ne correspond aux filtres.</p></CommercialPanel> : null}
    </div>
  );
}

function VisitRow({ visit }: { visit: VisitData }) {
  return (
    <CommercialPanel className="p-4 transition hover:border-[#bdc9ba]">
      <div className="grid items-center gap-4 lg:grid-cols-[190px_minmax(250px,1fr)_200px_150px_170px_auto]">
        <div><p className="text-xs font-bold text-[#2f493a]">{visit.date}</p><p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#6f7873]"><Clock3 className="size-3.5" /> Durée prévue : 1h</p></div>
        <div><Link href={`/commercial/visites/${visit.id}`} className="text-sm font-bold hover:underline">{visit.title}</Link><p className="mt-1 flex items-center gap-1.5 text-xs text-[#6f7873]"><MapPin className="size-3.5" />{visit.location}</p></div>
        <div><p className="text-[10px] uppercase text-[#7b837f]">Acquéreur</p><p className="mt-1 flex items-center gap-2 text-xs font-semibold"><UserRound className="size-4" />{visit.buyer}</p></div>
        <div><p className="text-[10px] uppercase text-[#7b837f]">Conseiller</p><p className="mt-1 flex items-center gap-2 text-xs font-semibold"><AgentAvatar name={visit.agent} size="xs" />{visit.agent}</p></div>
        <div className="flex flex-col items-start gap-2"><CommercialBadge tone={visitTone(visit.status)}>{visit.status}</CommercialBadge>{visit.note ? <span className="flex items-center gap-1 text-[11px] font-semibold"><Star className="size-3.5 fill-[#c28b2c] text-[#c28b2c]" /> Intérêt {visit.note}/5</span> : null}{visit.reportMissing ? <CommercialBadge tone="danger">Compte rendu à faire</CommercialBadge> : null}</div>
        <div className="flex items-center justify-end gap-2">{visit.reportMissing ? <Link href={`/commercial/visites/${visit.id}/compte-rendu`} className={cn(commercialPrimaryButton, "px-3 text-xs")}>Rédiger</Link> : <Link href={`/commercial/visites/${visit.id}`} className={cn(commercialSecondaryButton, "px-3 text-xs")}>Voir</Link>}<button type="button" aria-label="Plus d'actions" className="grid size-9 place-items-center rounded-lg border border-[#dfddd4]"><MoreHorizontal className="size-4" /></button></div>
      </div>
    </CommercialPanel>
  );
}

export function VisitDetailScreen({ id }: { id: string }) {
  const visit = visitFixtures.find((item) => item.id === id) ?? visitFixtures[0];
  return (
    <div className="grid gap-6">
      <Link href="/commercial/visites" className="inline-flex w-fit items-center gap-2 text-xs font-semibold text-[#53615a]"><ArrowLeft className="size-4" />Retour aux visites</Link>
      <CommercialPageHeader title={visit.title} description={`${visit.location} · ${visit.date}`} action={<><button type="button" className={commercialSecondaryButton}>Modifier</button><Link href={`/commercial/visites/${id}/compte-rendu`} className={commercialPrimaryButton}><MessageSquareText className="size-4" />Compte rendu</Link></>} />
      <div className="-mt-4 flex gap-2"><CommercialBadge tone={visitTone(visit.status)}>{visit.status}</CommercialBadge><DataSourceNotice /></div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <CommercialPanel className="p-6"><h2 className="text-lg font-bold">Informations de la visite</h2><dl className="mt-5 grid gap-6 sm:grid-cols-2"><Detail label="Date et heure" value={visit.date} /><Detail label="Durée prévue" value="1h00" /><Detail label="Point de rendez-vous" value="Devant le portail principal" /><Detail label="Conseiller" value={visit.agent} /><Detail label="Confirmation" value="Confirmée par SMS le 27 juillet" /><Detail label="Créée le" value="24 juillet 2026" /></dl></CommercialPanel>
          <CommercialPanel className="p-6"><h2 className="text-lg font-bold">Bien visité</h2><div className="mt-5 grid gap-4 sm:grid-cols-[140px_1fr]"><div className="min-h-28 rounded-xl bg-[linear-gradient(135deg,#cbd6c5,#809387)]" /><div><p className="text-base font-bold">{visit.title}</p><p className="mt-2 flex items-center gap-2 text-sm text-[#65706a]"><MapPin className="size-4" />{visit.location}</p><p className="mt-3 text-sm">5 pièces · 145 m² · 4 chambres</p><p className="mt-3 text-xl font-bold text-[#2f493a]">850 000 €</p></div></div></CommercialPanel>
          <CommercialPanel className="p-6"><h2 className="text-lg font-bold">Notes de préparation</h2><p className="mt-4 text-sm leading-7 text-[#606b65]">L&apos;acquéreur recherche une résidence principale avec vue mer et espace extérieur. Vérifier l&apos;accès au garage et présenter les travaux récents.</p></CommercialPanel>
        </div>
        <div className="grid gap-5">
          <CommercialPanel className="p-6"><h2 className="text-lg font-bold">Acquéreur</h2><div className="mt-5 flex items-center gap-3"><div className="grid size-12 place-items-center rounded-full bg-[#dce5d7] font-bold">{visit.buyer.split(" ").map((word) => word[0]).join("")}</div><div><p className="font-bold">{visit.buyer}</p><p className="text-xs text-[#6f7873]">Acquéreur qualifié</p></div></div><div className="mt-5 grid gap-2"><button type="button" className={commercialSecondaryButton}><Phone className="size-4" />06 12 34 56 78</button><button type="button" className={commercialSecondaryButton}>Envoyer un message</button></div></CommercialPanel>
          <CommercialPanel className="p-6"><h2 className="text-lg font-bold">Actions rapides</h2><div className="mt-4 grid gap-2"><button type="button" className={commercialSecondaryButton}>Confirmer la visite</button><button type="button" className={commercialSecondaryButton}>Replanifier</button><Link href="/commercial/offres/nouvelle" className={commercialPrimaryButton}>Créer une offre</Link></div></CommercialPanel>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-[#707a75]">{label}</dt><dd className="mt-2 text-sm font-bold">{value}</dd></div>;
}

const calendarEntries = [
  { day: "Lundi 27", time: "09h30", title: "Villa Les Issambres", buyer: "Julien Bernard", agent: "Antoine" },
  { day: "Lundi 27", time: "14h00", title: "Appartement Fréjus", buyer: "Claire Martin", agent: "Sophie" },
  { day: "Mardi 28", time: "10h00", title: "Maison Hyères", buyer: "Sophie Leroy", agent: "Antoine" },
  { day: "Mercredi 29", time: "11h00", title: "Villa Sainte-Maxime", buyer: "Isabelle Rossi", agent: "Sophie" },
  { day: "Jeudi 30", time: "15h30", title: "Studio Fréjus Port", buyer: "Pierre Moreau", agent: "Antoine" },
  { day: "Vendredi 31", time: "09h00", title: "Villa Saint-Tropez", buyer: "Marc Durand", agent: "Sophie" },
];

export function VisitsCalendarScreen() {
  const days = ["Lundi 27", "Mardi 28", "Mercredi 29", "Jeudi 30", "Vendredi 31"];
  return (
    <div className="grid gap-6">
      <CommercialPageHeader title="Calendrier des visites" description="Semaine du 27 au 31 juillet 2026" action={<><Link href="/commercial/visites" className={commercialSecondaryButton}>Vue liste</Link><button type="button" className={commercialPrimaryButton}><Plus className="size-4" />Planifier</button></>} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <CommercialPanel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#dfddd4] px-5 py-4"><button type="button" className={commercialSecondaryButton}>‹</button><strong>27 — 31 juillet 2026</strong><button type="button" className={commercialSecondaryButton}>›</button></div>
          <div className="grid min-w-[850px] grid-cols-5 overflow-x-auto">
            {days.map((day) => <div key={day} className="min-h-[560px] border-r border-[#e4e1d9] p-3 last:border-r-0"><div className="border-b border-[#e4e1d9] pb-3 text-center"><p className="text-xs font-bold uppercase">{day.split(" ")[0]}</p><p className="mt-1 text-2xl font-bold">{day.split(" ")[1]}</p></div><div className="mt-4 grid gap-3">{calendarEntries.filter((entry) => entry.day === day).map((entry, index) => <Link href="/commercial/visites/demo-visit-1" key={`${entry.time}-${entry.title}`} className={cn("rounded-xl border p-3", index % 2 ? "border-[#d8c9a4] bg-[#f7edd7]" : "border-[#bfd1b9] bg-[#dce5d7]")}><p className="text-[11px] font-bold">{entry.time}</p><p className="mt-2 text-xs font-bold leading-5">{entry.title}</p><p className="mt-2 text-[10px] text-[#627069]">{entry.buyer}</p><p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold"><AgentAvatar name={entry.agent} size="xs" />{entry.agent}</p></Link>)}</div></div>)}
          </div>
        </CommercialPanel>
        <div className="grid gap-4"><CommercialPanel className="p-5"><h2 className="font-bold">Cette semaine</h2><div className="mt-4 grid gap-4">{[["Visites planifiées","6"],["Confirmées","4"],["À confirmer","2"],["Disponibilités","8 créneaux"]].map(([label,value]) => <div key={label} className="flex items-center justify-between border-b border-[#e5e2da] pb-3 last:border-0"><span className="text-xs text-[#68716c]">{label}</span><strong>{value}</strong></div>)}</div></CommercialPanel><CommercialPanel className="p-5"><h2 className="font-bold">Conseillers</h2><div className="mt-4 grid gap-3"><p className="flex items-center gap-2 text-sm"><AgentAvatar name="Antoine" />Antoine <strong className="ml-auto">3</strong></p><p className="flex items-center gap-2 text-sm"><AgentAvatar name="Sophie" />Sophie <strong className="ml-auto">3</strong></p></div></CommercialPanel></div>
      </div>
    </div>
  );
}

const reportOptions = ["Très lumineux", "Bon état général", "Belle vue", "Calme", "Bonne distribution", "Extérieur apprécié", "Travaux à prévoir", "Prix trop élevé"];

export function VisitReportScreen({ id }: { id: string }) {
  const [selected, setSelected] = useState<string[]>(["Très lumineux", "Belle vue", "Extérieur apprécié"]);
  const [interest, setInterest] = useState(4);
  const [comments, setComments] = useState("Très bonne impression générale. Le séjour et la vue ont particulièrement plu.");
  const [nextAction, setNextAction] = useState("offer");
  const [feedback, setFeedback] = useState<{ type: "loading" | "success" | "error"; message: string } | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      if (id.startsWith("demo-")) {
        return { success: true, persisted: false, message: "Compte rendu conservé dans l'aperçu Figma." };
      }
      const response = await fetch("/api/admin/commercial", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit-visit-report",
          id,
          generalImpression: interest >= 4 ? "POSITIVE" : interest >= 3 ? "MIXED" : "NEGATIVE",
          positivePoints: selected.filter((item) => !["Travaux à prévoir", "Prix trop élevé"].includes(item)),
          blockingPoints: selected.filter((item) => ["Travaux à prévoir", "Prix trop élevé"].includes(item)),
          interestLevel: interest,
          comments,
          nextAction: nextAction === "offer" ? "CREATE_OFFER" : nextAction === "second-visit" ? "PLAN_VISIT" : "NO_FOLLOW_UP",
        }),
      });
      const payload = await response.json().catch(() => null) as { success?: boolean; message?: string } | null;
      if (!response.ok || !payload?.success) throw new Error(payload?.message ?? "Enregistrement impossible.");
      return payload;
    },
    onMutate: () => setFeedback({ type: "loading", message: "Enregistrement du compte rendu…" }),
    onSuccess: (payload) => setFeedback({ type: "success", message: payload.message ?? "Compte rendu enregistré." }),
    onError: (error) => setFeedback({ type: "error", message: error instanceof Error ? error.message : "Erreur inattendue." }),
  });
  function toggle(option: string) { setSelected((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option]); }
  return (
    <div className="grid gap-6">
      <Link href={`/commercial/visites/${id}`} className="inline-flex w-fit items-center gap-2 text-xs font-semibold text-[#53615a]"><ArrowLeft className="size-4" />Retour à la visite</Link>
      <CommercialPageHeader title="Compte rendu de visite" description="Appartement T3 Saint-Raphaël · 28 juillet 2026 à 14h00" />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          <CommercialPanel className="p-6"><h2 className="text-lg font-bold">Impression de l&apos;acquéreur</h2><p className="mt-1 text-xs text-[#6f7873]">Sélectionnez les points évoqués pendant ou après la visite.</p><div className="mt-5 flex flex-wrap gap-2">{reportOptions.map((option) => { const active = selected.includes(option); return <button key={option} type="button" onClick={() => toggle(option)} aria-pressed={active} className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold", active ? "border-[#2f493a] bg-[#dce5d7] text-[#274331]" : "border-[#dfddd4] bg-white")} >{active ? <Check className="size-3.5" /> : null}{option}</button>; })}</div></CommercialPanel>
          <CommercialPanel className="p-6"><h2 className="text-lg font-bold">Niveau d&apos;intérêt</h2><p className="mt-1 text-xs text-[#6f7873]">Évaluez de 1 à 5 la probabilité de donner suite.</p><div className="mt-5 flex gap-3">{[1,2,3,4,5].map((score) => <button key={score} type="button" onClick={() => setInterest(score)} aria-label={`Intérêt ${score} sur 5`} aria-pressed={score <= interest} className={cn("grid size-12 place-items-center rounded-xl border", score <= interest ? "border-[#c28b2c] bg-[#f7edd7] text-[#a46f16]" : "border-[#dfddd4] text-[#adb2af]")}><Star className={cn("size-5", score <= interest && "fill-current")} /></button>)}</div></CommercialPanel>
          <CommercialPanel className="p-6"><FieldLabel htmlFor="visit-comments">Commentaires détaillés</FieldLabel><textarea id="visit-comments" value={comments} onChange={(event) => setComments(event.target.value)} className={cn(fieldClass, "min-h-36 py-3")} /></CommercialPanel>
          <CommercialPanel className="p-6"><h2 className="text-lg font-bold">Prochaine action</h2><div className="mt-4 grid gap-2">{[["offer","Préparer une offre","L'acquéreur souhaite se positionner"],["second-visit","Planifier une seconde visite","Avec un proche ou un artisan"],["follow-up","Relancer plus tard","Créer une tâche de suivi"],["none","Aucune suite","Clôturer ce parcours de visite"]].map(([value,label,description]) => <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#dfddd4] p-4"><input type="radio" name="next-action" checked={nextAction === value} onChange={() => setNextAction(value)} className="mt-1 accent-[#2f493a]" /><span><strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs text-[#6f7873]">{description}</span></span></label>)}</div></CommercialPanel>
        </div>
        <CommercialPanel className="sticky top-24 p-6"><h2 className="text-lg font-bold">Résumé de la visite</h2><dl className="mt-5 grid gap-4"><Detail label="Bien" value="Appartement T3 Saint-Raphaël" /><Detail label="Acquéreur" value="Thomas Petit" /><Detail label="Conseiller" value="Antoine Fardoini" /><Detail label="Intérêt" value={`${interest}/5`} /></dl><button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || comments.trim().length < 4} className={cn(commercialPrimaryButton, "mt-6 w-full")}>Enregistrer le compte rendu</button><Link href={`/commercial/visites/${id}`} className={cn(commercialSecondaryButton, "mt-3 w-full")}>Enregistrer plus tard</Link></CommercialPanel>
      </div>
      <CommercialFeedback state={feedback} />
    </div>
  );
}
