import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CommercialDataError } from "@/lib/commercial-service";
import type { AdminSession } from "@/types/admin";
import type { Database } from "@/types/supabase";

type CommercialClient = SupabaseClient<Database>;

const managerRoles = new Set(["ADMIN", "DIRECTOR"]);
const sensitiveRoles = new Set(["ADMIN", "DIRECTOR", "AGENT"]);

export function canManageAllCommercialObjects(session: AdminSession) {
  return managerRoles.has(session.profile.role);
}

export function assertSensitiveCommercialAccess(session: AdminSession) {
  if (!sensitiveRoles.has(session.profile.role)) {
    throw new CommercialDataError(
      "Ce contenu commercial confidentiel n'est pas accessible avec votre rôle.",
      403,
    );
  }
}

export function assertCommercialAssignment(
  session: AdminSession,
  assignedTo: string | null | undefined,
) {
  if (
    !canManageAllCommercialObjects(session) &&
    assignedTo &&
    assignedTo !== session.user.id
  ) {
    throw new CommercialDataError(
      "Seule la direction peut attribuer ce dossier à un autre conseiller.",
      403,
    );
  }
}

export async function assertEligibleCommercialAssignee(
  client: CommercialClient,
  session: AdminSession,
  assignedTo: string,
) {
  assertCommercialAssignment(session, assignedTo);
  const { data, error } = await client
    .from("profiles")
    .select("id,is_active,role")
    .eq("id", assignedTo)
    .maybeSingle();
  if (error) throw error;
  if (
    !data?.is_active ||
    !["ADMIN", "DIRECTOR", "AGENT"].includes(data.role)
  ) {
    throw new CommercialDataError("Conseiller commercial invalide.", 400);
  }
}

function assertOwned(
  session: AdminSession,
  ownerId: string | null,
  label: string,
) {
  if (
    session.profile.role === "AGENT" &&
    ownerId !== session.user.id
  ) {
    throw new CommercialDataError(
      `${label} est assigné à un autre conseiller.`,
      403,
    );
  }
}

export async function assertLeadAccess(
  client: CommercialClient,
  session: AdminSession,
  leadId: string,
) {
  if (session.profile.role !== "AGENT") return;
  const { data, error } = await client
    .from("leads")
    .select("assigned_to")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CommercialDataError("Dossier commercial introuvable.", 404);
  assertOwned(session, data.assigned_to, "Ce dossier commercial");
}

export async function assertTaskAccess(
  client: CommercialClient,
  session: AdminSession,
  taskId: string,
) {
  if (session.profile.role !== "AGENT") return;
  const { data, error } = await client
    .from("tasks")
    .select("assigned_to,lead_id")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CommercialDataError("Tâche introuvable.", 404);
  if (data.assigned_to === session.user.id) return;
  if (data.lead_id) {
    await assertLeadAccess(client, session, data.lead_id);
    return;
  }
  throw new CommercialDataError("Cette tâche est assignée à un autre conseiller.", 403);
}

export async function assertEstimationAccess(
  client: CommercialClient,
  session: AdminSession,
  estimationId: string,
) {
  if (session.profile.role !== "AGENT") return;
  const { data, error } = await client
    .from("estimations")
    .select("assigned_to")
    .eq("id", estimationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CommercialDataError("Estimation introuvable.", 404);
  assertOwned(session, data.assigned_to, "Cette estimation");
}

export async function assertVisitAccess(
  client: CommercialClient,
  session: AdminSession,
  visitId: string,
) {
  if (session.profile.role !== "AGENT") return;
  const { data, error } = await client
    .from("appointments")
    .select("assigned_to")
    .eq("id", visitId)
    .eq("appointment_type", "VISIT")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CommercialDataError("Visite introuvable.", 404);
  assertOwned(session, data.assigned_to, "Cette visite");
}

export async function assertOfferAccess(
  client: CommercialClient,
  session: AdminSession,
  offerId: string,
) {
  assertSensitiveCommercialAccess(session);
  if (session.profile.role !== "AGENT") return;
  const { data, error } = await client
    .from("offers")
    .select("responsible_user_id")
    .eq("id", offerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CommercialDataError("Offre introuvable.", 404);
  assertOwned(session, data.responsible_user_id, "Cette offre");
}

export async function assertNegotiationAccess(
  client: CommercialClient,
  session: AdminSession,
  negotiationId: string,
) {
  assertSensitiveCommercialAccess(session);
  if (session.profile.role !== "AGENT") return;
  const { data, error } = await client
    .from("negotiations")
    .select("responsible_user_id")
    .eq("id", negotiationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CommercialDataError("Négociation introuvable.", 404);
  assertOwned(session, data.responsible_user_id, "Cette négociation");
}
