import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/supabase";

// Caller must verify the isolated project and database marker before calling.
export async function cleanupContactRecipe(db: SupabaseClient<Database>, run: string) {
  assert.match(run, /^CONTACT_E2E_\d{13}$/);
  const contactRows = await db.from("contacts").select("id,name").like("name", `${run} %`);
  const profileRows = await db.from("profiles").select("id,email").like("email", `${run.toLowerCase()}-%@example.test`);
  const propertyRows = await db.from("properties").select("id,title").like("title", `${run} %`);
  assert.ifError(contactRows.error); assert.ifError(profileRows.error); assert.ifError(propertyRows.error);
  const contacts = (contactRows.data ?? []).filter(row => row.name.startsWith(`${run} `)).map(row => row.id);
  const profiles = (profileRows.data ?? []).filter(row => row.email.startsWith(`${run.toLowerCase()}-`) && row.email.endsWith("@example.test")).map(row => row.id);
  const properties = (propertyRows.data ?? []).filter(row => row.title.startsWith(`${run} `)).map(row => row.id);
  if (contacts.length) {
    const leads = await db.from("leads").select("id").in("contact_id", contacts);
    const visits = await db.from("appointments").select("id").in("contact_id", contacts);
    const offers = await db.from("offers").select("id").in("buyer_contact_id", contacts);
    assert.ifError(leads.error); assert.ifError(visits.error); assert.ifError(offers.error);
    const leadIds = (leads.data ?? []).map(row => row.id), visitIds = (visits.data ?? []).map(row => row.id), offerIds = (offers.data ?? []).map(row => row.id);
    if (offerIds.length) {
      const docs = await db.from("offer_documents").select("storage_bucket,storage_path").in("offer_id", offerIds); assert.ifError(docs.error);
      for (const doc of docs.data ?? []) assert.ifError((await db.storage.from(doc.storage_bucket).remove([doc.storage_path])).error);
      assert.ifError((await db.from("offer_documents").delete().in("offer_id", offerIds)).error);
      assert.ifError((await db.from("offer_status_history").delete().in("offer_id", offerIds)).error);
      assert.ifError((await db.from("offers").delete().in("id", offerIds)).error);
    }
    assert.ifError((await db.from("tasks").delete().in("contact_id", contacts)).error);
    if (leadIds.length) assert.ifError((await db.from("tasks").delete().in("lead_id", leadIds)).error);
    if (visitIds.length) assert.ifError((await db.from("appointments").delete().in("id", visitIds)).error);
    const entityIds = [...contacts, ...leadIds, ...visitIds, ...offerIds, ...properties];
    assert.ifError((await db.from("activities").delete().in("entity_id", entityIds)).error);
    assert.ifError((await db.from("audit_logs").delete().in("entity_id", entityIds)).error);
    assert.ifError((await db.from("lead_merge_logs").delete().in("primary_contact_id", contacts)).error);
    if (leadIds.length) assert.ifError((await db.from("leads").delete().in("id", leadIds)).error);
    assert.ifError((await db.from("contacts").delete().in("id", contacts)).error);
  }
  if (properties.length) assert.ifError((await db.from("properties").delete().in("id", properties)).error);
  for (const id of profiles) {
    assert.ifError((await db.from("audit_logs").delete().eq("actor_id", id)).error);
    assert.ifError((await db.from("profiles").delete().eq("id", id)).error);
    assert.ifError((await db.auth.admin.deleteUser(id)).error);
  }
  return { contacts: contacts.length, profiles: profiles.length, properties: properties.length };
}
