"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Result = { success: boolean; message: string };

export function PropertyLeadForm({ title, reference, city }: { title: string; reference: string; city: string }) {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", message: `Bonjour, je souhaite en savoir plus sur le bien « ${title} » (réf. ${reference}).` });
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, requestType: "Achat", city }),
      });
      const payload = (await response.json()) as Result;
      setResult(payload);
      if (response.ok) setForm((current) => ({ ...current, fullName: "", email: "", phone: "" }));
    } catch {
      setResult({ success: false, message: "La demande n'a pas pu être envoyée. Appelez directement l'agence." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {result ? (
        <p className={result.success ? "rounded-md bg-emerald-50 p-3 text-sm text-emerald-800" : "rounded-md bg-red-50 p-3 text-sm text-red-700"}>
          {result.message}
        </p>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="property-name">Nom complet</Label>
        <Input id="property-name" required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <div className="grid gap-2">
          <Label htmlFor="property-email">Email</Label>
          <Input id="property-email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="property-phone">Téléphone</Label>
          <Input id="property-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="property-message">Message</Label>
        <Textarea id="property-message" required rows={4} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
      </div>
      <Button disabled={loading} className="h-11 bg-orange-500 text-white hover:bg-orange-600">
        {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
        {loading ? "Envoi..." : "Demander des informations"}
      </Button>
    </form>
  );
}
