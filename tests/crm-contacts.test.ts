import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contactActionSchema,
  contactNeedsFollowUp,
  contactPermissions,
  contactsCsv,
  findContactDuplicate,
  normalizeContactSearch,
} from "../src/lib/contact-rules";
import type { AdminCrmLead, PipelineTask } from "../src/types/crm";

const id = "3f660da3-bc56-49c9-b727-458612de11c2";
const contact = (updates: Partial<AdminCrmLead> = {}) =>
  ({
    id,
    name: "Élodie",
    email: "elodie@example.test",
    phone: "+33600000000",
    normalizedEmail: "elodie@example.test",
    normalizedPhone: "33600000000",
    dedupeStatus: "UNREVIEWED",
    archived: false,
    category: "Achat",
    city: "Hyères",
    estimatedBudget: null,
    ...updates,
  }) as AdminCrmLead;
test("recherche insensible aux accents et à la casse", () =>
  assert.equal(normalizeContactSearch("  HYÈRES "), "hyeres"));
test("les droits distinguent lecture, édition, attribution et suppression", () => {
  assert.deepEqual(contactPermissions("READ_ONLY"), {
    canWrite: false,
    canDelete: false,
    canAssign: false,
    canExport: false,
  });
  assert.equal(contactPermissions("AGENT").canAssign, false);
  assert.equal(contactPermissions("ASSISTANT").canDelete, false);
  assert.equal(contactPermissions("ADMIN").canDelete, true);
});
test("tâche valide et champs invalides", () => {
  assert.equal(
    contactActionSchema.safeParse({
      action: "create-task",
      title: "Appeler",
      assignedTo: null,
      dueAt: "2026-09-10T09:00:00+02:00",
    }).success,
    true,
  );
  assert.equal(
    contactActionSchema.safeParse({
      action: "create-task",
      title: "x",
      assignedTo: null,
      dueAt: "demain",
    }).success,
    false,
  );
  assert.equal(
    contactActionSchema.safeParse({
      action: "complete-task",
      taskId: id,
      completed: "true",
    }).success,
    false,
  );
  assert.equal(
    contactActionSchema.safeParse({
      action: "log-activity",
      kind: "SEND_EMAIL",
      description: "Bonjour",
    }).success,
    false,
  );
});
test("doublon exact et conservation des deux contacts", () => {
  const other = contact({ id: "other" });
  assert.equal(findContactDuplicate(contact(), [other])?.id, "other");
  assert.equal(
    findContactDuplicate(contact({ dedupeStatus: "IGNORED" }), [other]),
    null,
  );
  assert.equal(
    findContactDuplicate(contact(), [contact({ id: "other", archived: true })]),
    null,
  );
  assert.equal(
    findContactDuplicate(
      contact({
        normalizedEmail: "fake@legacy.immo-dreams83.local",
        normalizedPhone: null,
      }),
      [
        contact({
          id: "other",
          normalizedEmail: "fake@legacy.immo-dreams83.local",
        }),
      ],
    ),
    null,
  );
});
test("le projet refuse les budgets inversés", () => {
  const project = {
    action: "update-project",
    projectId: id,
    budgetMin: 300000,
    budgetMax: 200000,
    financingApproved: false,
    city: "Hyères",
    notes: "Terrasse",
  };
  assert.equal(contactActionSchema.safeParse(project).success, false);
  assert.equal(
    contactActionSchema.safeParse({ ...project, budgetMin: null }).success,
    true,
  );
});
test("export inclut les archives sélectionnées et neutralise les formules", () => {
  const csv = contactsCsv([
    contact({ name: '=HYPERLINK("evil")', archived: true }),
  ]);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('"Oui"'));
  assert.ok(csv.startsWith("\uFEFF"));
  assert.equal(
    contactsCsv([
      contact({ email: "fake@legacy.immo-dreams83.local" }),
    ]).includes("legacy.immo"),
    false,
  );
});
test("à relancer signifie tâche ouverte échue du contact ou de son dossier", () => {
  const task = {
    contactId: id,
    leadId: null,
    dueAt: "2026-09-09T09:00:00Z",
    completedAt: null,
    status: "TODO",
  } as PipelineTask;
  const now = Date.parse("2026-09-10T09:00:00Z");
  assert.equal(contactNeedsFollowUp(id, [], [task], now), true);
  assert.equal(
    contactNeedsFollowUp(id, [], [{ ...task, status: "COMPLETED" }], now),
    false,
  );
  assert.equal(
    contactNeedsFollowUp(id, [], [{ ...task, status: "CANCELLED" }], now),
    false,
  );
  assert.equal(
    contactNeedsFollowUp(id, [], [{ ...task, completedAt: task.dueAt }], now),
    false,
  );
  assert.equal(contactNeedsFollowUp("other", [], [task], now), false);
  assert.equal(
    contactNeedsFollowUp(
      id,
      ["dossier"],
      [{ ...task, contactId: null, leadId: "dossier" }],
      now,
    ),
    true,
  );
});
