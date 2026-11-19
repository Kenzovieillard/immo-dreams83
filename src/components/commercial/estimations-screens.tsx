"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowRight, CalendarDays, ChevronDown, Download, FileText, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { estimationFixtures, type EstimationData } from "./commercial-data";
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

function estimationTone(status: EstimationData["status"]): "success" | "warning" | "danger" | "neutral" {
  if (["Réalisée", "Rapport envoyé", "Terminée"].includes(status)) return "success";
  if (["Nouvelle demande", "Planifiée"].includes(status)) return "warning";
  if (status === "Sans suite") return "danger";
  return "neutral";
}

const estimationTabs = ["Toutes", "Nouvelle demande", "À contacter", "Planifiée", "Réalisée", "Rapport envoyé", "Sans suite"] as const;

export function EstimationsListScreen() {
  const [activeTab, setActiveTab] = useState<(typeof estimationTabs)[number]>("Toutes");
  const [search, setSearch] = useState("");
  const rows = useMemo(() => estimationFixtures.filter((item) => {
    const matchesTab = activeTab === "Toutes" || item.status === activeTab;
    const haystack = `${item.owner} ${item.address} ${item.type}`.toLocaleLowerCase("fr");
    return matchesTab && haystack.includes(search.toLocaleLowerCase("fr"));
  }), [activeTab, search]);

  const metrics = [
    ["Nouvelles demandes", "4", "info"],
    ["À planifier", "3", "danger"],
    ["Planifiées cette semaine", "5", "neutral"],
    ["Réalisées ce mois", "8", "neutral"],
    ["Mandats obtenus", "3", "success"],
  ] as const;

  return (
    <div className="grid gap-7">
      <CommercialPageHeader title="Estimations" description="Demandes, rendez-vous et rapports d'estimation" action={<Link href="/commercial/estimations/nouvelle" className={commercialPrimaryButton}><Plus className="size-4" />Nouvelle estimation</Link>} />
      <div className="flex justify-end"><DataSourceNotice /></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(([label, value, tone]) => <CommercialPanel key={label} className="p-4"><div className="flex items-start justify-between"><p className="text-xs text-[#66706b]">{label}</p><span className={cn("size-2 rounded-full", tone === "danger" ? "bg-[#a94d43]" : tone === "success" ? "bg-[#4d7a5c]" : tone === "info" ? "bg-[#4f8fb8]" : "bg-[#c28b2c]")} /></div><p className="mt-3 text-3xl font-bold">{value}</p></CommercialPanel>)}</div>
      <div className="flex gap-2 overflow-x-auto pb-1">{estimationTabs.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={cn("inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold", activeTab === tab ? "border-[#17221e] bg-[#17221e] text-white" : "border-[#dfddd4] bg-[#fbfaf7]")}>{tab}<span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", activeTab === tab ? "bg-white/15" : "bg-[#dce5d7]")}>{tab === "Toutes" ? 23 : estimationFixtures.filter((item) => item.status === tab).length}</span></button>)}</div>
      <CommercialPanel className="p-3"><div className="grid gap-2 md:grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(130px,.7fr))]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#75807a]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher..." aria-label="Rechercher une estimation" className={cn(fieldClass, "min-h-9 pl-10")} /></div>{["Vendeur: Tous", "Secteur: Tous", "Type de bien: Tous", "Période: Tous"].map((label) => <button type="button" key={label} className="flex min-h-9 items-center justify-between rounded-lg border border-[#dfddd4] bg-[#fbfaf7] px-3 text-xs">{label}<ChevronDown className="size-3.5" /></button>)}</div></CommercialPanel>
      <CommercialPanel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
            <thead className="bg-[#f6f4ef] text-[10px] uppercase tracking-wide text-[#68716c]"><tr>{["Propriétaire / Adresse", "Type de bien", "Date demande", "Date RDV", "Vendeur", "Statut", "Estimation", "Prochaine action", ""].map((label) => <th key={label} className="border-b border-[#dfddd4] px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody>{rows.map((item) => <tr key={item.id} className="border-b border-[#e9e6de] last:border-0 hover:bg-[#f9f8f4]"><td className="px-4 py-3"><div className="flex items-center gap-3"><AgentAvatar name={item.agent ?? "Antoine"} size="sm" /><div className="min-w-0"><p className="font-semibold">{item.owner}</p><p className="mt-0.5 max-w-[230px] truncate text-[11px] text-[#68716c]">{item.address}</p></div></div></td><td className="px-4 py-3">{item.type}</td><td className="px-4 py-3">{item.requestDate}</td><td className={cn("px-4 py-3", item.appointment === "À planifier" && "font-semibold text-[#c27a0b]")}>{item.appointment}</td><td className="px-4 py-3">{item.agent ? <span className="flex items-center gap-2"><AgentAvatar name={item.agent} size="xs" />{item.agent}</span> : <span className="text-[#8a918d]">Non attribué</span>}</td><td className="px-4 py-3"><CommercialBadge tone={estimationTone(item.status)}>{item.status}</CommercialBadge></td><td className="whitespace-nowrap px-4 py-3 font-semibold">{item.estimate ?? "—"}</td><td className="px-4 py-3"><Link href={item.action.includes("Transformer") || item.status === "Réalisée" ? `/commercial/estimations/${item.id}` : "/commercial/estimations/nouvelle"} className="inline-flex rounded-md bg-[#dce5d7] px-3 py-2 text-[11px] font-semibold text-[#2f493a]">{item.action}</Link></td><td className="px-4 py-3"><MoreHorizontal className="size-4" /></td></tr>)}</tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[#dfddd4] px-4 py-4 text-xs text-[#68716c]"><span>Page 1 sur 3 · 23 estimations</span><div className="flex items-center gap-2"><button className="grid size-8 place-items-center rounded-lg border" type="button">‹</button><button className="grid size-8 place-items-center rounded-lg bg-[#2f493a] text-white" type="button">1</button><button className="grid size-8 place-items-center rounded-lg" type="button">2</button><button className="grid size-8 place-items-center rounded-lg" type="button">3</button><button className="grid size-8 place-items-center rounded-lg border" type="button">›</button></div></div>
      </CommercialPanel>
      <CommercialPanel className="p-5"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">Calendrier des rendez-vous cette semaine</h2><p className="mt-1 text-xs text-[#6f7873]">Rendez-vous d&apos;estimations physiques et points de situation</p></div><CalendarDays className="size-5 text-[#52625a]" /></div><div className="mt-5 grid gap-3 md:grid-cols-5">{[["Lundi","11h00","Appartement T3 Fréjus","Marc Durand"],["Mardi","","Aucun RDV",""],["Mercredi","10h00","Villa Les Issambres","Julien Bernard"],["Jeudi","14h00","Villa contemporaine","Les Issambres"],["Vendredi","09h00","Villa Mimosas","Nathalie Vidal"]].map(([day,time,title,name], index) => <div key={day} className="min-h-32 rounded-xl bg-[#f6f4ef] p-3"><p className="text-[10px] font-bold uppercase">{day}</p>{time ? <div className={cn("mt-3 rounded-lg border border-[#dfddd4] p-3", index === 2 || index === 3 ? "bg-[#dce5d7]" : "bg-[#fbfaf7]")}><p className="text-[10px] font-semibold">{time}</p><p className="mt-2 text-xs font-bold">{title}</p><p className="mt-1 text-[10px] text-[#747d78]">{name}</p></div> : <p className="mt-12 text-center text-[10px] text-[#b1b5b2]">Aucun RDV</p>}</div>)}</div></CommercialPanel>
    </div>
  );
}

function TransformEstimationModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [price, setPrice] = useState("810000");
  const [mandate, setMandate] = useState<"EXCLUSIVE" | "SEMI_EXCLUSIVE" | "SIMPLE">("EXCLUSIVE");
  const [feedback, setFeedback] = useState<{ type: "loading" | "success" | "error"; message: string } | null>(null);
  const mutation = useMutation({ mutationFn: async () => {
    if (id.startsWith("demo-")) {
      return { success: true, persisted: false, message: "Transformation simulée dans l'aperçu Figma." };
    }
    const response = await fetch("/api/admin/commercial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "transform-estimation", id, listingPrice: Number(price), mandateType: mandate }) });
    const payload = await response.json().catch(() => null) as { success?: boolean; message?: string } | null;
    if (!response.ok || !payload?.success) throw new Error(payload?.message ?? "Transformation impossible.");
    return payload;
  }, onMutate: () => setFeedback({ type: "loading", message: "Création du bien et du dossier vendeur…" }), onSuccess: (payload) => { setFeedback({ type: "success", message: payload.message ?? "Bien créé." }); window.setTimeout(onClose, 900); }, onError: (error) => setFeedback({ type: "error", message: error instanceof Error ? error.message : "Erreur." }) });
  const options = [
    ["EXCLUSIVE", "Mandat Exclusif (Recommandé)", "Commission réduite à 4%, visibilité maximale"],
    ["SEMI_EXCLUSIVE", "Mandat Semi-exclusif", "Commission de 5%, liberté de vendre en direct"],
    ["SIMPLE", "Mandat Simple", "Commission de 6%, multi-agences"],
  ] as const;
  return <div className="fixed inset-0 z-[75] grid place-items-center bg-[#17221e]/60 p-4"><div role="dialog" aria-modal="true" aria-labelledby="transform-title" className="w-full max-w-[610px] rounded-3xl bg-[#fbfaf7] p-6 shadow-2xl sm:p-8"><div className="flex items-center justify-between"><h2 id="transform-title" className="text-xl font-bold">Transformer l&apos;estimation en bien</h2><button type="button" onClick={onClose} aria-label="Fermer" className="grid size-9 place-items-center rounded-full bg-[#eef1eb]"><X className="size-4" /></button></div><div className="my-5 h-px bg-[#dfddd4]" /><h3 className="text-sm font-bold">Données de l&apos;estimation</h3><div className="mt-3 rounded-xl bg-[#f6f4ef] p-4 text-xs leading-6 text-[#66706b]">Adresse : 45 av. des Mimosas, Les Issambres<br />Type : Villa Provençale · 145 m²</div><div className="mt-5"><FieldLabel htmlFor="listing-price">Prix de mise en vente (€)</FieldLabel><input id="listing-price" value={price} onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className={fieldClass} /></div><fieldset className="mt-5"><legend className="mb-3 text-sm font-semibold">Type de mandat</legend><div className="grid gap-2">{options.map(([value,label,description]) => <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#dfddd4] p-3"><input type="radio" name="mandate" checked={mandate === value} onChange={() => setMandate(value)} className="mt-1 accent-[#2f493a]" /><span><strong className="block text-sm">{label}</strong><span className="mt-1 block text-[11px] text-[#6f7873]">{description}</span></span></label>)}</div></fieldset><div className="mt-6 flex justify-end gap-3 border-t border-[#dfddd4] pt-5"><button type="button" onClick={onClose} className={commercialSecondaryButton}>Annuler</button><button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || !Number(price)} className={commercialPrimaryButton}>Créer le bien</button></div></div><CommercialFeedback state={feedback} /></div>;
}

export function EstimationDetailScreen({ id }: { id: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  return <div className="grid gap-6"><CommercialPageHeader title="45 av. des Mimosas, Les Issambres" description="Réf. EST-83042 · Ajouté le 20 Juillet 2026 par Antoine Fardoini" action={<><button type="button" className={commercialSecondaryButton}>Générer rapport PDF</button><button type="button" className={commercialPrimaryButton}>Modifier l&apos;estimation</button><button type="button" onClick={() => setModalOpen(true)} className={commercialPrimaryButton}><ArrowRight className="size-4" />Transformer en bien</button></>} /><div className="-mt-4"><CommercialBadge tone="success">Réalisée</CommercialBadge></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="grid gap-5"><CommercialPanel className="p-6"><h2 className="text-lg font-bold">Informations du bien</h2><dl className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{[["Type","Villa provençale"],["Surface habitable","145 m²"],["Pièces","5 pièces (4 chambres)"],["Surface terrain","1 200 m²"],["Année construction","2012"],["État général","Très bon état"]].map(([label,value]) => <div key={label}><dt className="text-xs text-[#707a75]">{label}</dt><dd className="mt-2 text-sm font-bold">{value}</dd></div>)}</dl></CommercialPanel><CommercialPanel className="p-6"><h2 className="text-lg font-bold">Fourchette de prix estimée</h2><div className="mt-6 flex items-center justify-between text-xs text-[#68716c]"><span>Bas de marché</span><strong className="text-lg text-[#2f493a]">Conseillé : 810 000 €</strong><span>Haut de marché</span></div><div className="relative mt-4 h-3 rounded-full bg-[#efede7]"><div className="absolute inset-y-0 left-0 w-[47%] rounded-full bg-[#dce5d7]" /></div><div className="mt-3 flex justify-between text-base font-bold"><span>780 000 €</span><span>850 000 €</span></div></CommercialPanel></div><CommercialPanel className="h-fit p-6"><h2 className="text-lg font-bold">Rapport PDF</h2><div className="mt-4 flex items-center gap-3 rounded-xl bg-[#f6f4ef] p-4"><FileText className="size-6 text-[#2f493a]" /><div><p className="text-sm font-bold">Rapport_Les_Mimosas.pdf</p><p className="mt-1 text-xs text-[#737c77]">2.4 Mo · Généré hier</p></div></div><button type="button" className={cn(commercialSecondaryButton, "mt-4 w-full")}><Download className="size-4" />Télécharger le rapport</button></CommercialPanel></div><CommercialPanel className="p-6"><h2 className="text-lg font-bold">Comparables de marché</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-[#f6f4ef] text-xs"><tr>{["Bien comparable","Surface","Prix vendu","Date de vente"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{[["12 av. du Golfe, Les Issambres","150 m²","830 000 €","Mars 2026"],["38 bd des Pins, Les Issambres","138 m²","790 000 €","Janvier 2026"],["4 av. des Mimosas (Voisin)","142 m²","815 000 €","Novembre 2025"]].map((row) => <tr key={row[0]} className="border-b border-[#e5e2da] last:border-0">{row.map((cell,index) => <td key={cell} className={cn("px-4 py-4", index === 2 && "font-bold")}>{cell}</td>)}</tr>)}</tbody></table></div></CommercialPanel>{modalOpen ? <TransformEstimationModal id={id} onClose={() => setModalOpen(false)} /> : null}</div>;
}

const estimationFormSchema = z.object({
  ownerName: z.string().min(2, "Sélectionnez un propriétaire."),
  address: z.string().min(5, "Adresse obligatoire."),
  city: z.string().min(2),
  postalCode: z.string().min(4),
  propertyType: z.string().min(2),
  surface: z.coerce.number().positive(),
  rooms: z.coerce.number().int().positive(),
  constructionYear: z.coerce.number().int().min(1700).max(2200),
  propertyCondition: z.string().min(2),
  appointmentDate: z.string().min(8),
  timeSlot: z.string().min(2),
  durationMinutes: z.coerce.number().int().min(15),
  appointmentLocation: z.string().min(2),
  notes: z.string().max(4000),
});
type EstimationFormInput = z.input<typeof estimationFormSchema>;
type EstimationFormValues = z.output<typeof estimationFormSchema>;

export function EstimationCreateScreen() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ type: "loading" | "success" | "error"; message: string } | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EstimationFormInput, unknown, EstimationFormValues>({ resolver: zodResolver(estimationFormSchema), defaultValues: { ownerName: "Marc Durand", address: "45 avenue des Mimosas, Les Issambres", city: "Les Issambres", postalCode: "83380", propertyType: "Villa", surface: 120, rooms: 5, constructionYear: 2012, propertyCondition: "Bon état", appointmentDate: "2026-08-28", timeSlot: "10h00 - 11h00", durationMinutes: 60, appointmentLocation: "Sur place - 45 av. des Mimosas", notes: "" } });
  async function submit(values: EstimationFormValues) { setFeedback({ type: "loading", message: "Création de l'estimation…" }); if (window.location.pathname.startsWith("/crm-riviera-commercial-preview")) { setFeedback({ type: "success", message: "Estimation créée dans l'aperçu Figma." }); return; } const response = await fetch("/api/admin/commercial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create-estimation", ownerName: values.ownerName, ownerEmail: "m.durand@example.com", ownerPhone: "+33 6 12 34 56 78", address: values.address, city: values.city, postalCode: values.postalCode, propertyType: values.propertyType, surface: values.surface, rooms: values.rooms, constructionYear: values.constructionYear, propertyCondition: values.propertyCondition, appointmentAt: new Date(`${values.appointmentDate}T10:00:00+02:00`).toISOString(), timeSlot: values.timeSlot, durationMinutes: values.durationMinutes, appointmentLocation: values.appointmentLocation, notes: values.notes }) }); const payload = await response.json().catch(() => null) as { success?: boolean; message?: string; estimation?: { id?: string } } | null; if (!response.ok || !payload?.success) { setFeedback({ type: "error", message: payload?.message ?? "Création impossible." }); return; } setFeedback({ type: "success", message: payload.message ?? "Estimation créée." }); window.setTimeout(() => router.push(`/commercial/estimations/${payload.estimation?.id ?? "demo-estimation-mimosas"}`), 800); }
  const inputError = (name: keyof EstimationFormInput) => errors[name] ? <p className="mt-1 text-xs text-[#a94d43]">{String(errors[name]?.message)}</p> : null;
  return <form onSubmit={handleSubmit(submit)} className="grid gap-6"><CommercialPageHeader eyebrow="Estimations · Création" title="Nouvelle demande d'estimation" description="Planifiez une estimation et attribuez-la à un conseiller" /><div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="grid gap-5"><CommercialPanel className="p-6"><h2 className="text-lg font-bold">Choix du propriétaire</h2><div className="mt-4"><FieldLabel htmlFor="ownerName">Rechercher un contact existant</FieldLabel><input id="ownerName" {...register("ownerName")} className={fieldClass} />{inputError("ownerName")}</div></CommercialPanel><CommercialPanel className="p-6"><h2 className="text-lg font-bold">Adresse et informations du bien</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><FieldLabel htmlFor="address">Adresse complète</FieldLabel><input id="address" {...register("address")} className={fieldClass} />{inputError("address")}</div><div><FieldLabel htmlFor="city">Ville</FieldLabel><input id="city" {...register("city")} className={fieldClass} /></div><div><FieldLabel htmlFor="postalCode">Code postal</FieldLabel><input id="postalCode" {...register("postalCode")} className={fieldClass} /></div><div><FieldLabel htmlFor="propertyType">Type de bien</FieldLabel><select id="propertyType" {...register("propertyType")} className={fieldClass}><option>Villa</option><option>Appartement</option><option>Maison</option><option>Studio</option><option>Terrain</option></select></div><div><FieldLabel htmlFor="surface">Surface habitable</FieldLabel><input id="surface" type="number" {...register("surface")} className={fieldClass} /></div><div><FieldLabel htmlFor="rooms">Nombre de pièces</FieldLabel><input id="rooms" type="number" {...register("rooms")} className={fieldClass} /></div><div><FieldLabel htmlFor="constructionYear">Année de construction</FieldLabel><input id="constructionYear" type="number" {...register("constructionYear")} className={fieldClass} /></div><div className="sm:col-span-2"><FieldLabel htmlFor="propertyCondition">État général</FieldLabel><select id="propertyCondition" {...register("propertyCondition")} className={fieldClass}><option>Bon état</option><option>Très bon état</option><option>À rafraîchir</option><option>À rénover</option></select></div></div></CommercialPanel><CommercialPanel className="p-6"><h2 className="text-lg font-bold">Planification du rendez-vous</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><FieldLabel htmlFor="appointmentDate">Date du rendez-vous</FieldLabel><input id="appointmentDate" type="date" {...register("appointmentDate")} className={fieldClass} /></div><div><FieldLabel htmlFor="timeSlot">Créneau horaire</FieldLabel><select id="timeSlot" {...register("timeSlot")} className={fieldClass}><option>10h00 - 11h00</option><option>14h00 - 15h00</option><option>16h30 - 17h30</option></select></div><div><FieldLabel htmlFor="durationMinutes">Durée estimée</FieldLabel><select id="durationMinutes" {...register("durationMinutes")} className={fieldClass}><option value="60">1 heure</option><option value="90">1 heure 30</option><option value="120">2 heures</option></select></div><div><FieldLabel htmlFor="appointmentLocation">Lieu de rendez-vous</FieldLabel><input id="appointmentLocation" {...register("appointmentLocation")} className={fieldClass} /></div></div></CommercialPanel><CommercialPanel className="p-6"><h2 className="text-lg font-bold">Conseiller responsable</h2><div className="mt-5"><FieldLabel>Conseiller responsable</FieldLabel><div className={cn(fieldClass, "flex items-center gap-3")}><AgentAvatar name="Antoine" />Antoine Fardoini<ChevronDown className="ml-auto size-4" /></div></div><div className="mt-4"><FieldLabel htmlFor="notes">Notes internes (optionnel)</FieldLabel><textarea id="notes" {...register("notes")} className={cn(fieldClass, "min-h-28 py-3")} placeholder="Ajouter des notes…" /></div></CommercialPanel></div><CommercialPanel className="sticky top-24 p-6"><h2 className="text-lg font-bold">Validation</h2><p className="mt-4 text-sm leading-6 text-[#6f7873]">Veuillez vérifier toutes les informations avant de planifier le premier rendez-vous d&apos;estimation.</p><button type="submit" disabled={isSubmitting} className={cn(commercialPrimaryButton, "mt-5 w-full")}>{isSubmitting ? "Création…" : "Créer l'estimation"}</button><Link href="/commercial/estimations" className={cn(commercialSecondaryButton, "mt-3 w-full")}>Annuler</Link></CommercialPanel></div><CommercialFeedback state={feedback} /></form>;
}
