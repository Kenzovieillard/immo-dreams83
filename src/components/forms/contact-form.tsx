"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ContactFormState = {
  fullName: string;
  email: string;
  phone: string;
  requestType: string;
  city: string;
  message: string;
};

type ApiResult = {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

const initialFormState: ContactFormState = {
  fullName: "",
  email: "",
  phone: "",
  requestType: "Estimation",
  city: "",
  message: "",
};

export function ContactForm() {
  const [form, setForm] = useState<ContactFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  function updateField(field: keyof ContactFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => null)) as ApiResult | null;

      if (!response.ok || !payload?.success) {
        setResult({
          success: false,
          message:
            payload?.message ??
            "La demande n'a pas pu être envoyée. Merci de vérifier les informations.",
          fieldErrors: payload?.fieldErrors,
        });
        return;
      }

      setResult(payload);
      setForm(initialFormState);
    } catch {
      setResult({
        success: false,
        message:
          "La connexion au formulaire est momentanément indisponible. Merci de réessayer.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const disabled = isSubmitting;

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-5 rounded-xl border border-orange-100 bg-white p-6 shadow-xl shadow-orange-100/60"
    >
      {result ? (
        <div
          className={
            result.success
              ? "rounded-lg border border-emerald-200 bg-emerald-50 p-4"
              : "rounded-lg border border-red-200 bg-red-50 p-4"
          }
        >
          <Badge
            className={
              result.success
                ? "border-0 bg-emerald-600 text-white"
                : "border-0 bg-red-600 text-white"
            }
          >
            {result.success ? "Demande envoyée" : "Envoi impossible"}
          </Badge>
          <p className="mt-3 text-sm leading-6 text-gray-700">{result.message}</p>
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="contact-fullName">Nom complet</Label>
        <Input
          id="contact-fullName"
          name="fullName"
          required
          disabled={disabled}
          value={form.fullName}
          onChange={(event) => updateField("fullName", event.target.value)}
          placeholder="Votre nom"
        />
        {result?.fieldErrors?.fullName ? (
          <p className="text-xs font-semibold text-red-600">{result.fieldErrors.fullName}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            required
            disabled={disabled}
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="vous@email.fr"
          />
          {result?.fieldErrors?.email ? (
            <p className="text-xs font-semibold text-red-600">{result.fieldErrors.email}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact-phone">Téléphone</Label>
          <Input
            id="contact-phone"
            name="phone"
            disabled={disabled}
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="06 00 00 00 00"
          />
          <p className="text-xs text-gray-500">Recommandé pour un retour rapide.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Type de demande</Label>
          <Select
            name="requestType"
            value={form.requestType}
            onValueChange={(value) => updateField("requestType", value ?? "")}
          >
            <SelectTrigger className="h-10 w-full" disabled={disabled}>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Achat">Achat</SelectItem>
              <SelectItem value="Vente">Vente</SelectItem>
              <SelectItem value="Estimation">Estimation</SelectItem>
              <SelectItem value="Terrain">Terrain</SelectItem>
              <SelectItem value="Autre">Autre</SelectItem>
            </SelectContent>
          </Select>
          {result?.fieldErrors?.requestType ? (
            <p className="text-xs font-semibold text-red-600">
              {result.fieldErrors.requestType}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact-city">Ville concernée</Label>
          <Input
            id="contact-city"
            name="city"
            disabled={disabled}
            value={form.city}
            onChange={(event) => updateField("city", event.target.value)}
            placeholder="Solliès-Pont"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          name="message"
          required
          disabled={disabled}
          value={form.message}
          onChange={(event) => updateField("message", event.target.value)}
          rows={6}
          placeholder="Présentez votre projet : vente, achat, estimation, terrain, délai souhaité..."
        />
        {result?.fieldErrors?.message ? (
          <p className="text-xs font-semibold text-red-600">{result.fieldErrors.message}</p>
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={disabled}
        className="h-12 bg-orange-500 text-white hover:bg-orange-600"
      >
        {isSubmitting ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        {isSubmitting ? "Envoi en cours..." : "Envoyer ma demande"}
      </Button>
    </form>
  );
}
