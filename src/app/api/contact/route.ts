import { NextRequest, NextResponse } from "next/server";
import { sendLeadEmail } from "@/lib/email-service";
import {
  FieldErrors,
  getStringField,
  hasRequiredValue,
  isValidEmail,
} from "@/lib/lead-validation";
import { getSupabaseAdminClient, getSupabaseClient } from "@/lib/supabase";

const requestTypes = ["Achat", "Vente", "Estimation", "Terrain", "Autre"] as const;

function validateContactPayload(payload: unknown) {
  const fullName = getStringField(payload, "fullName");
  const email = getStringField(payload, "email");
  const phone = getStringField(payload, "phone");
  const requestType = getStringField(payload, "requestType");
  const city = getStringField(payload, "city");
  const message = getStringField(payload, "message");
  const fieldErrors: FieldErrors = {};

  if (!hasRequiredValue(fullName)) fieldErrors.fullName = "Le nom complet est obligatoire.";
  if (!hasRequiredValue(email)) fieldErrors.email = "L'email est obligatoire.";
  else if (!isValidEmail(email)) fieldErrors.email = "L'email n'est pas valide.";
  if (!requestTypes.includes(requestType as (typeof requestTypes)[number])) {
    fieldErrors.requestType = "Le type de demande est obligatoire.";
  }
  if (!hasRequiredValue(message)) fieldErrors.message = "Le message est obligatoire.";

  return { data: { fullName, email, phone, requestType, city, message }, fieldErrors };
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const { data, fieldErrors } = validateContactPayload(payload);

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { success: false, message: "Certains champs doivent être corrigés.", fieldErrors },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();
    const supabase = admin ?? getSupabaseClient();
    let leadId: string | null = null;

    if (supabase) {
      const { data: lead, error } = await supabase
        .from("contacts")
        .insert({
          name: data.fullName,
          email: data.email,
          phone: data.phone || null,
          request_type: data.requestType,
          city: data.city || null,
          message: data.message,
          status: "NEW",
          archived: false,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[IMMO-DREAMS83] Contact persistence failed", error.message);
        return NextResponse.json(
          { success: false, message: "La demande n'a pas pu être enregistrée. Merci de réessayer." },
          { status: 500 }
        );
      }

      leadId = lead.id;
      if (admin) {
        await admin.from("activities").insert({
          entity_type: "contact",
          entity_id: leadId,
          action: "Nouvelle demande de contact",
          user_name: "Site public",
        });
      }
    } else if (process.env.NODE_ENV === "development") {
      console.info("[IMMO-DREAMS83] Contact reçu en mode local", data);
    }

    const emailResult = await sendLeadEmail({
      subject: `[Contact ${data.requestType}] ${data.fullName}`,
      replyTo: data.email,
      text: `${data.message}\n\nTéléphone : ${data.phone || "Non renseigné"}\nVille : ${data.city || "Non renseignée"}`,
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
      message: "Votre demande a bien été envoyée. L'agence vous recontactera rapidement.",
      leadId,
    });
  } catch (error) {
    console.error("[IMMO-DREAMS83] Contact route error", error);
    return NextResponse.json(
      { success: false, message: "Une erreur est survenue. Merci de réessayer dans quelques instants." },
      { status: 500 }
    );
  }
}
