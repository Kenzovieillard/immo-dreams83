"use client";

import { FormEvent, useState } from "react";
import { Calculator, LoaderCircle } from "lucide-react";
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

type EstimationFormState = {
  fullName: string;
  email: string;
  phone: string;
  propertyType: string;
  city: string;
  postalCode: string;
  surface: string;
  rooms: string;
  estimatedPrice: string;
  message: string;
};

type ApiResult = {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

const initialFormState: EstimationFormState = {
  fullName: "",
  email: "",
  phone: "",
  propertyType: "Maison",
  city: "",
  postalCode: "",
  surface: "",
  rooms: "",
  estimatedPrice: "",
  message: "",
};

export function EstimationForm() {
  const [form, setForm] = useState<EstimationFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  function updateField(field: keyof EstimationFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/estimation", {
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
            "La demande d'estimation n'a pas pu être envoyée. Merci de vérifier les informations.",
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="estimate-fullName">Nom complet</Label>
          <Input
            id="estimate-fullName"
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
        <div className="grid gap-2">
          <Label htmlFor="estimate-email">Email</Label>
          <Input
            id="estimate-email"
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="estimate-phone">Téléphone</Label>
          <Input
            id="estimate-phone"
            name="phone"
            required
            disabled={disabled}
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="06 00 00 00 00"
          />
          {result?.fieldErrors?.phone ? (
            <p className="text-xs font-semibold text-red-600">{result.fieldErrors.phone}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label>Type de bien</Label>
          <Select
            name="propertyType"
            value={form.propertyType}
            onValueChange={(value) => updateField("propertyType", value ?? "")}
          >
            <SelectTrigger className="h-10 w-full" disabled={disabled}>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Appartement">Appartement</SelectItem>
              <SelectItem value="Maison">Maison</SelectItem>
              <SelectItem value="Terrain">Terrain</SelectItem>
              <SelectItem value="Immeuble">Immeuble</SelectItem>
              <SelectItem value="Autre">Autre</SelectItem>
            </SelectContent>
          </Select>
          {result?.fieldErrors?.propertyType ? (
            <p className="text-xs font-semibold text-red-600">
              {result.fieldErrors.propertyType}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="estimate-city">Ville</Label>
          <Input
            id="estimate-city"
            name="city"
            required
            disabled={disabled}
            value={form.city}
            onChange={(event) => updateField("city", event.target.value)}
            placeholder="Solliès-Pont"
          />
          {result?.fieldErrors?.city ? (
            <p className="text-xs font-semibold text-red-600">{result.fieldErrors.city}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="estimate-postalCode">Code postal</Label>
          <Input
            id="estimate-postalCode"
            name="postalCode"
            inputMode="numeric"
            disabled={disabled}
            value={form.postalCode}
            onChange={(event) => updateField("postalCode", event.target.value)}
            placeholder="83210"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="estimate-surface">Surface</Label>
          <Input
            id="estimate-surface"
            name="surface"
            required
            inputMode="numeric"
            disabled={disabled}
            value={form.surface}
            onChange={(event) => updateField("surface", event.target.value)}
            placeholder="120"
          />
          {result?.fieldErrors?.surface ? (
            <p className="text-xs font-semibold text-red-600">{result.fieldErrors.surface}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="estimate-rooms">Nombre de pièces</Label>
          <Input
            id="estimate-rooms"
            name="rooms"
            inputMode="numeric"
            disabled={disabled}
            value={form.rooms}
            onChange={(event) => updateField("rooms", event.target.value)}
            placeholder="5"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="estimate-estimatedPrice">Prix estimé</Label>
          <Input
            id="estimate-estimatedPrice"
            name="estimatedPrice"
            inputMode="numeric"
            disabled={disabled}
            value={form.estimatedPrice}
            onChange={(event) => updateField("estimatedPrice", event.target.value)}
            placeholder="450000"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="estimate-message">Message</Label>
        <Textarea
          id="estimate-message"
          name="message"
          disabled={disabled}
          value={form.message}
          onChange={(event) => updateField("message", event.target.value)}
          rows={5}
          placeholder="Adresse, état du bien, délai de vente souhaité, informations utiles..."
        />
      </div>

      <Button
        type="submit"
        disabled={disabled}
        className="h-11 bg-orange-500 text-white hover:bg-orange-600"
      >
        {isSubmitting ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Calculator className="size-4" aria-hidden="true" />
        )}
        {isSubmitting ? "Envoi en cours..." : "Demander mon estimation"}
      </Button>
    </form>
  );
}
