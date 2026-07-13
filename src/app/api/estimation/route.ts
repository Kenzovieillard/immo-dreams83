import { NextRequest, NextResponse } from "next/server";
import { sendLeadEmail } from "@/lib/email-service";
import {
  FieldErrors,
  getStringField,
  hasRequiredValue,
  isPositiveNumberLike,
  isValidEmail,
} from "@/lib/lead-validation";
import { getSupabaseAdminClient, getSupabaseClient } from "@/lib/supabase";

const propertyTypes = ["Appartement", "Maison", "Terrain", "Immeuble", "Autre"] as const;

function toNumber(value: string) {
  return value ? Number(value.replace(",", ".").replace(/\s/g, "")) : null;
}

function validateEstimationPayload(payload: unknown) {
  const fullName = getStringField(payload, "fullName");
  const email = getStringField(payload, "email");
  const phone = getStringField(payload, "phone");
  const propertyType = getStringField(payload, "propertyType");
  const city = getStringField(payload, "city");
  const postalCode = getStringField(payload, "postalCode");
  const surface = getStringField(payload, "surface");
  const rooms = getStringField(payload, "rooms");
  const estimatedPrice = getStringField(payload, "estimatedPrice");
  const message = getStringField(payload, "message");
  const fieldErrors: FieldErrors = {};

  if (!hasRequiredValue(fullName)) fieldErrors.fullName = "Le nom complet est obligatoire.";
  if (!hasRequiredValue(email)) fieldErrors.email = "L'email est obligatoire.";
  else if (!isValidEmail(email)) fieldErrors.email = "L'email n'est pas valide.";
  if (!hasRequiredValue(phone)) fieldErrors.phone = "Le téléphone est obligatoire.";
  if (!propertyTypes.includes(propertyType as (typeof propertyTypes)[number])) {
    fieldErrors.propertyType = "Le type de bien est obligatoire.";
  }
  if (!hasRequiredValue(city)) fieldErrors.city = "La ville est obligatoire.";
  if (!hasRequiredValue(surface)) fieldErrors.surface = "La surface est obligatoire.";
  else if (!isPositiveNumberLike(surface)) {
    fieldErrors.surface = "La surface doit être un nombre supérieur à 0.";
  }

  return {
    data: { fullName, email, phone, propertyType, city, postalCode, surface, rooms, estimatedPrice, message },
    fieldErrors,
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const { data, fieldErrors } = validateEstimationPayload(payload);

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { success: false, message: "Certains champs doivent être corrigés.", fieldErrors },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    let leadId: string | null = null;

    if (supabase) {
      const details = [data.message, data.estimatedPrice ? `Prix envisagé : ${data.estimatedPrice} €` : ""]
        .filter(Boolean)
        .join("\n\n");
      const { data: lead, error } = await supabase
        .from("estimations")
        .insert({
          name: data.fullName,
          email: data.email,
          phone: data.phone,
          property_type: data.propertyType,
          city: data.city,
          postal_code: data.postalCode || null,
          surface: toNumber(data.surface),
          rooms: toNumber(data.rooms),
          message: details || null,
          status: "NEW",
        })
        .select("id")
        .single();

      if (error) {
        console.error("[IMMO-DREAMS83] Estimation persistence failed", error.message);
        return NextResponse.json(
          { success: false, message: "La demande n'a pas pu être enregistrée. Merci de réessayer." },
          { status: 500 }
        );
      }

      leadId = lead.id;
      const admin = getSupabaseAdminClient();
      if (admin) {
        await admin.from("activities").insert({
          entity_type: "estimation",
          entity_id: leadId,
          action: "Nouvelle demande d'estimation",
          user_name: "Site public",
        });
      }
    } else if (process.env.NODE_ENV === "development") {
      console.info("[IMMO-DREAMS83] Estimation reçue en mode local", data);
    }

    const emailResult = await sendLeadEmail({
      subject: `[Estimation ${data.propertyType}] ${data.fullName}`,
      replyTo: data.email,
      text: `Ville : ${data.city} ${data.postalCode}\nSurface : ${data.surface} m²\nPièces : ${data.rooms || "Non renseigné"}\n\n${data.message}`,
    });

    if (!leadId && !emailResult.sent && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          success: false,
          message: "Le formulaire est momentanément indisponible. Appelez directement l'agence au 06 72 88 15 34.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Votre demande d'estimation a bien été envoyée. L'agence vous recontactera pour affiner votre projet.",
      leadId,
    });
  } catch (error) {
    console.error("[IMMO-DREAMS83] Estimation route error", error);
    return NextResponse.json(
      { success: false, message: "Une erreur est survenue pendant l'envoi. Merci de réessayer." },
      { status: 500 }
    );
  }
}
