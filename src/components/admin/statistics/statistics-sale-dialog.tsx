"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { parisDay } from "@/lib/agenda-time";
import type { StatisticsAdvisor } from "@/lib/statistics";

type Candidate = {
  id: string;
  label: string;
  advisorId: string | null;
  sale: { advisor_id: string | null; signed_on: string; sale_price: number; fee_excl_tax: number; updated_at: string } | null;
};

const endpoint = "/api/admin/statistics/sales";
const field = "h-10 w-full rounded-lg border border-[#dedfd4] bg-[#fbfaf7] px-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#2f493a]";

export function StatisticsSaleDialog({ open, onOpenChange, advisors, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; advisors: StatisticsAdvisor[]; onSaved: () => void;
}) {
  const [search, setSearch] = useState("");
  const propertyField = useId();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ query: string; options: Candidate[]; error?: string } | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const signal = new AbortController();
    fetch(`${endpoint}?${new URLSearchParams({ q: query })}`, { cache: "no-store", signal: signal.signal })
      .then(async response => {
        const payload = await response.json() as { properties?: Candidate[]; message?: string };
        if (!response.ok || !payload.properties) throw new Error(payload.message ?? "Recherche indisponible.");
        if (!signal.signal.aborted) setResult({ query, options: payload.properties });
      }).catch((err: unknown) => {
        if (!signal.signal.aborted) setResult({ query, options: [], error: err instanceof Error ? err.message : "Recherche indisponible." });
      });
    return () => signal.abort();
  }, [open, query]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    const form = new FormData(event.currentTarget);
    setError("");
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selected.id, advisorId: form.get("advisor") || null,
          signedOn: form.get("signedOn"), price: Number(form.get("price")), fee: Number(form.get("fee")),
          expected: selected.sale?.updated_at ?? null,
        }),
      });
      const payload = await response.json() as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) throw new Error(payload.message ?? "Enregistrement impossible.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  const options = result?.query === query ? result.options : [];
  const loading = !result || result.query !== query;
  const owner = selected?.sale ? selected.sale.advisor_id : selected?.advisorId;
  return <Sheet open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
    <SheetContent className="w-full overflow-y-auto p-5 sm:max-w-lg">
      <SheetHeader className="p-0 pr-9">
        <SheetTitle>Saisir une vente actée</SheetTitle>
        <SheetDescription>Renseignez les montants de l’acte signé. Pour une nouvelle saisie, le bien doit être au statut Vendu.</SheetDescription>
      </SheetHeader>
      <form className="flex items-end gap-2" onSubmit={event => {
        event.preventDefault();
        const next = search.trim();
        if (next !== query) { setQuery(next); setSelected(null); setError(""); }
      }}>
        <label className="grid min-w-0 flex-1 gap-1 text-sm font-medium">
          Rechercher un bien vendu
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Référence, titre ou commune" />
        </label>
        <Button type="submit" variant="outline">Rechercher</Button>
      </form>
      {loading ? <p role="status" className="text-sm text-[#58675e]">Recherche en cours…</p> : result.error ? <p role="alert" className="text-sm text-[#a2473e]">{result.error}</p> : (
        <div className="grid gap-1 text-sm font-medium">
          <label htmlFor={propertyField}>Bien vendu</label>
          <select id={propertyField} className={field} value={options.some(row => row.id === selected?.id) ? selected?.id : ""} onChange={event => { setSelected(options.find(row => row.id === event.target.value) ?? null); setError(""); }}>
            <option value="">{options.length ? "Choisir un bien" : "Aucun bien vendu correspondant"}</option>
            {options.map(row => <option key={row.id} value={row.id}>{row.label}{row.sale ? " · acte renseigné" : ""}</option>)}
          </select>
        </div>
      )}
      {selected ? <form key={selected.id} onSubmit={save} className="grid gap-3">
        <label className="grid gap-1 text-sm font-medium">Conseiller
          <select name="advisor" className={field} defaultValue={owner ?? ""}>
            <option value="">Non attribué</option>
            {advisors.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">Date de signature de l’acte
          <Input name="signedOn" type="date" min="2000-01-01" max={parisDay()} defaultValue={selected.sale?.signed_on ?? parisDay()} required />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">Prix signé (€)
            <Input name="price" type="number" step="0.01" min="0.01" max="1000000000" defaultValue={selected.sale?.sale_price} required />
          </label>
          <label className="grid gap-1 text-sm font-medium">Honoraires HT (€)
            <Input name="fee" type="number" step="0.01" min="0" max="1000000000" defaultValue={selected.sale?.fee_excl_tax} required />
          </label>
        </div>
        {error ? <p role="alert" className="text-sm text-[#a2473e]">{error}</p> : null}
        <Button type="submit" disabled={saving} className="justify-self-end bg-[#2f493a] text-white hover:bg-[#243b2e]">
          {saving ? "Enregistrement…" : selected.sale ? "Mettre à jour" : "Enregistrer la vente"}
        </Button>
      </form> : null}
    </SheetContent>
  </Sheet>;
}
