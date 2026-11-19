import assert from "node:assert/strict";
import { test } from "node:test";
import { reorderPipelineCards } from "../src/lib/commercial-pipeline-order";
import { pipelineMutationSchema } from "../src/lib/commercial-validation";

const cards = ["a", "hidden", "b", "c"].map((id) => ({
  id,
  stage: "BUYER_NEW",
}));
test("relative insertion keeps hidden cards and does not mutate original", () => {
  assert.deepEqual(
    reorderPipelineCards(cards, "c", "a", "before").map((c) => c.id),
    ["c", "a", "hidden", "b"],
  );
  assert.deepEqual(
    reorderPipelineCards(cards, "a", "b", "after").map((c) => c.id),
    ["hidden", "b", "a", "c"],
  );
  assert.deepEqual(
    cards.map((c) => c.id),
    ["a", "hidden", "b", "c"],
  );
});
test("unknown, identical and cross-stage targets are no-ops", () => {
  assert.equal(reorderPipelineCards(cards, "a", "missing", "before"), cards);
  assert.equal(reorderPipelineCards(cards, "a", "a", "before"), cards);
  const mixed = [...cards, { id: "seller", stage: "SELLER_NEW" }];
  assert.equal(reorderPipelineCards(mixed, "a", "seller", "before"), mixed);
});
test("reorder contract validates IDs, stage and placement", () => {
  const input = {
    action: "reorder",
    id: "00000000-0000-4000-8000-000000000001",
    targetId: "00000000-0000-4000-8000-000000000002",
    stage: "BUYER_NEW",
    placement: "before",
  };
  assert(pipelineMutationSchema.safeParse(input).success);
  for (const patch of [
    { id: "bad" },
    { targetId: null },
    { placement: "top" },
    { stage: "bogus" },
  ]) {
    assert(!pipelineMutationSchema.safeParse({ ...input, ...patch }).success);
  }
});
