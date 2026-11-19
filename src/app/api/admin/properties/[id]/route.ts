import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  propertySearchText,
  type PropertyRelations,
} from "@/lib/property-workspace";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  const id = z.uuid().safeParse((await params).id);
  if (!id.success)
    return NextResponse.json(
      { success: false, message: "Identifiant de bien invalide." },
      { status: 400 },
    );
  const supabase = getSupabaseAdminClient();
  const unavailable = () =>
    NextResponse.json(
      {
        success: false,
        message: "Les données liées ne peuvent pas être chargées. Réessayez.",
      },
      { status: 503 },
    );
  if (!supabase) return unavailable();
  const lookup = await supabase
    .from("properties")
    .select(
      "id, type, city, price, surface, rooms, owner_contact_id, advisor_id",
    )
    .eq("id", id.data)
    .maybeSingle();
  if (lookup.error) return unavailable();
  if (!lookup.data)
    return NextResponse.json(
      { success: false, message: "Bien introuvable." },
      { status: 404 },
    );
  const property = lookup.data;

  let visits = supabase
    .from("appointments")
    .select(
      "id,title,starts_at,visit_status,interest_level,report_submitted_at",
    )
    .eq("property_id", id.data)
    .eq("appointment_type", "VISIT")
    .order("starts_at", { ascending: false });
  let offers = supabase
    .from("offers")
    .select("id,amount,status,created_at")
    .eq("property_id", id.data)
    .eq("is_test", false)
    .order("created_at", { ascending: false });
  let buyers = supabase
    .from("buyer_searches")
    .select(
      "id,contact_id,property_types,cities,max_budget,min_surface,min_rooms",
    )
    .eq("status", "active")
    .not("contact_id", "is", null);
  if (auth.session.profile.role === "AGENT") {
    const agent = auth.session.user.id;
    visits = visits.eq("assigned_to", agent);
    offers = offers.eq("responsible_user_id", agent);
    buyers = buyers.eq("assigned_to", agent);
  }

  const [
    visitResult,
    offerResult,
    buyerResult,
    mandateResult,
    activityResult,
    advisorResult,
  ] = await Promise.all([
    visits,
    offers,
    buyers,
    supabase
      .from("mandates")
      .select("id,mandate_number,mandate_type,status,signed_at,expires_at")
      .eq("property_id", id.data)
      .order("created_at", { ascending: false }),
    supabase
      .from("activities")
      .select("id,action,user_name,created_at")
      .eq("entity_type", "property")
      .eq("entity_id", id.data)
      .order("created_at", { ascending: false }),
    property.advisor_id
      ? supabase
          .from("profiles")
          .select("id,full_name,email")
          .eq("id", property.advisor_id)
          .maybeSingle()
      : { data: null, error: null },
  ]);
  if (
    visitResult.error ||
    offerResult.error ||
    buyerResult.error ||
    mandateResult.error ||
    activityResult.error ||
    advisorResult.error
  ) {
    return unavailable();
  }

  const compatible = (buyerResult.data ?? []).flatMap((search) => {
    const criteria = [];
    if (search.property_types.length) {
      if (!search.property_types.includes(property.type)) return [];
      criteria.push("Type");
    }
    if (search.cities.length) {
      if (
        !search.cities.some(
          (city) =>
            propertySearchText(city) === propertySearchText(property.city),
        )
      )
        return [];
      criteria.push("Commune");
    }
    if (search.max_budget != null) {
      if (!(property.price > 0 && property.price <= search.max_budget))
        return [];
      criteria.push("Budget");
    }
    if (search.min_surface != null) {
      if (!(property.surface >= search.min_surface)) return [];
      criteria.push("Surface");
    }
    if (search.min_rooms != null) {
      if (property.rooms == null || property.rooms < search.min_rooms)
        return [];
      criteria.push("Pièces");
    }
    return search.contact_id && criteria.length
      ? [{ search, criteria, contactId: search.contact_id }]
      : [];
  });
  const contactIds = Array.from(
    new Set([
      property.owner_contact_id,
      ...compatible.map((item) => item.contactId),
    ]),
  ).filter((id): id is string => Boolean(id));
  let contacts = supabase
    .from("contacts")
    .select("id,name")
    .in("id", contactIds)
    .eq("archived", false);
  if (auth.session.profile.role === "AGENT")
    contacts = contacts.eq("assigned_to", auth.session.user.id);
  const contactResult = contactIds.length
    ? await contacts
    : { data: [], error: null };
  if (contactResult.error) return unavailable();
  const names = new Map(
    (contactResult.data ?? []).map((contact) => [contact.id, contact.name]),
  );
  const visibleBuyers = new Map<string, PropertyRelations["buyers"][number]>();
  for (const item of compatible) {
    const name = names.get(item.contactId);
    if (!name || item.contactId === property.owner_contact_id) continue;
    const current = visibleBuyers.get(item.contactId);
    if (!current || current.criteria.length < item.criteria.length) {
      visibleBuyers.set(item.contactId, {
        id: item.contactId,
        name,
        budget: item.search.max_budget,
        criteria: item.criteria,
        status: "active",
      });
    }
  }
  const ownerName = property.owner_contact_id
    ? names.get(property.owner_contact_id)
    : null;
  const advisor = advisorResult.data;
  const relations: PropertyRelations = {
    owner:
      property.owner_contact_id && ownerName
        ? { id: property.owner_contact_id, name: ownerName }
        : null,
    advisor: advisor
      ? { id: advisor.id, name: advisor.full_name || advisor.email }
      : null,
    mandates: (mandateResult.data ?? []).map((row) => ({
      id: row.id,
      reference: row.mandate_number,
      type: row.mandate_type,
      status: row.status,
      signedAt: row.signed_at,
      expiresAt: row.expires_at,
    })),
    buyers: Array.from(visibleBuyers.values()).sort(
      (a, b) =>
        b.criteria.length - a.criteria.length ||
        a.name.localeCompare(b.name, "fr"),
    ),
    visits: (visitResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      startsAt: row.starts_at,
      status: row.visit_status ?? "TO_CONFIRM",
      interest: row.interest_level,
      reportSubmittedAt: row.report_submitted_at,
    })),
    offers: (offerResult.data ?? []).map((row) => ({
      id: row.id,
      amount: row.amount,
      status: row.status,
      createdAt: row.created_at,
    })),
    activities: (activityResult.data ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      author: row.user_name,
      createdAt: row.created_at,
    })),
  };
  return NextResponse.json(
    { success: true, relations },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
