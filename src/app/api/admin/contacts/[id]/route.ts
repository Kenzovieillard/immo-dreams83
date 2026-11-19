import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { checkContactAccess } from "@/lib/contact-access";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { ContactWorkspace } from "@/types/contact-workspace";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json(
      { success: false, message: "Contact invalide." },
      { status: 400 },
    );
  const client = getSupabaseAdminClient();
  if (!client)
    return NextResponse.json(
      { success: false, message: "Supabase non configuré." },
      { status: 503 },
    );
  const denied = await checkContactAccess(client, auth.session, id);
  if (denied)
    return NextResponse.json(
      { success: false, message: denied.message },
      { status: denied.status },
    );
  try {
    let leadQuery = client
      .from("leads")
      .select(
        "id,title,project_type,budget_min,budget_max,financing_approved,city,notes,linked_property_id",
      )
      .eq("contact_id", id);
    if (auth.session.profile.role === "AGENT")
      leadQuery = leadQuery.eq("assigned_to", auth.session.user.id);
    const leads = await leadQuery.limit(200);
    if (leads.error) throw leads.error;
    const leadIds = (leads.data ?? []).map((row) => row.id);
    const related = `contact_id.eq.${id}${leadIds.length ? `,lead_id.in.(${leadIds.join(",")})` : ""}`;
    let taskQuery = client
      .from("tasks")
      .select("id,title,due_at,status,completed_at,assigned_to")
      .or(related)
      .order("due_at");
    let visitQuery = client
      .from("appointments")
      .select(
        "id,title,starts_at,visit_status,property_id,interest_level,assigned_to",
      )
      .eq("appointment_type", "VISIT")
      .or(related)
      .order("starts_at", { ascending: false });
    let offerQuery = client
      .from("offers")
      .select("id")
      .or(`contact_id.eq.${id},buyer_contact_id.eq.${id}`);
    if (auth.session.profile.role === "AGENT") {
      taskQuery = taskQuery.eq("assigned_to", auth.session.user.id);
      visitQuery = visitQuery.eq("assigned_to", auth.session.user.id);
      offerQuery = offerQuery.eq("assigned_to", auth.session.user.id);
    }
    const [tasks, visits, offers] = await Promise.all([
      taskQuery.limit(200),
      visitQuery.limit(200),
      offerQuery.limit(200),
    ]);
    for (const result of [tasks, visits, offers])
      if (result.error) throw result.error;
    let searchQuery = client
      .from("buyer_searches")
      .select("id")
      .eq("contact_id", id);
    if (auth.session.profile.role === "AGENT")
      searchQuery = searchQuery.eq("assigned_to", auth.session.user.id);
    const searches = await searchQuery.limit(200);
    if (searches.error) throw searches.error;
    const matches = searches.data?.length
      ? await client
          .from("match_suggestions")
          .select("property_id")
          .in(
            "buyer_search_id",
            searches.data.map((row) => row.id),
          )
          .in("status", ["suggested", "proposed", "accepted"])
          .limit(200)
      : { data: [], error: null };
    if (matches.error) throw matches.error;
    const propertyIds = [
      ...new Set(
        [
          ...(leads.data ?? []).map((row) => row.linked_property_id),
          ...(visits.data ?? []).map((row) => row.property_id),
          ...(matches.data ?? []).map((row) => row.property_id),
        ].filter((id): id is string => !!id),
      ),
    ];
    const offerIds = (offers.data ?? []).map((row) => row.id);
    const entityIds = [
      id,
      ...leadIds,
      ...(visits.data ?? []).map((row) => row.id),
      ...offerIds,
    ];
    const [activities, properties] = await Promise.all([
      client
        .from("activities")
        .select("id,action,created_at,user_name,metadata")
        .in("entity_id", entityIds)
        .order("created_at", { ascending: false })
        .limit(500),
      propertyIds.length
        ? client
            .from("properties")
            .select("id,title,city,price,reference,status")
            .in("id", propertyIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (activities.error || properties.error)
      throw activities.error ?? properties.error;
    const documents: ContactWorkspace["documents"] = [];
    if (
      offerIds.length &&
      ["ADMIN", "DIRECTOR", "AGENT"].includes(auth.session.profile.role)
    ) {
      const docs = await client
        .from("offer_documents")
        .select("id,file_name,offer_id,created_at")
        .in("offer_id", offerIds)
        .limit(200);
      if (docs.error) throw docs.error;
      documents.push(
        ...(docs.data ?? []).map((row) => ({
          id: row.id,
          fileName: row.file_name,
          kind: "offer" as const,
          parentId: row.offer_id,
          createdAt: row.created_at,
        })),
      );
      let negotiationQuery = client
        .from("negotiations")
        .select("id")
        .in("offer_id", offerIds);
      if (auth.session.profile.role === "AGENT")
        negotiationQuery = negotiationQuery.eq(
          "responsible_user_id",
          auth.session.user.id,
        );
      const negotiations = await negotiationQuery;
      if (negotiations.error) throw negotiations.error;
      if (negotiations.data?.length) {
        const docs = await client
          .from("negotiation_documents")
          .select("id,file_name,negotiation_id,created_at")
          .in(
            "negotiation_id",
            negotiations.data.map((row) => row.id),
          )
          .limit(200);
        if (docs.error) throw docs.error;
        documents.push(
          ...(docs.data ?? []).map((row) => ({
            id: row.id,
            fileName: row.file_name,
            kind: "negotiation" as const,
            parentId: row.negotiation_id,
            createdAt: row.created_at,
          })),
        );
      }
    }
    const data: ContactWorkspace = {
      tasks: tasks.data ?? [],
      activities: activities.data ?? [],
      visits: visits.data ?? [],
      properties: properties.data ?? [],
      projects: leads.data ?? [],
      documents,
    };
    return NextResponse.json(
      { success: true, source: "supabase", data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "La fiche liée n'a pas pu être chargée. Réessayez.",
      },
      { status: 500 },
    );
  }
}
