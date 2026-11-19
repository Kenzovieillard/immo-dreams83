import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { commercialHrefForTab, commercialLinks } from "../src/lib/commercial-navigation";

test("the five commercial destinations are distinct existing App Router pages", () => {
  assert.deepEqual(commercialLinks.map(({ label, href }) => [label, href]), [
    ["Pipeline", "/commercial/pipeline"],
    ["Estimations", "/commercial/estimations"],
    ["Visites", "/commercial/visites"],
    ["Offres", "/commercial/offres"],
    ["Négociations", "/commercial/negociations"],
  ]);
  for (const link of commercialLinks) {
    assert.ok(existsSync(`src/app${link.href}/page.tsx`), link.href);
    assert.equal(commercialHrefForTab(link.key), link.href);
  }
});

test("legacy commercial tabs resolve without hijacking contacts or activity history", () => {
  assert.equal(commercialHrefForTab("pipeline"), "/commercial/pipeline");
  assert.equal(commercialHrefForTab("estimations"), "/commercial/estimations");
  for (const tab of [undefined, "overview", "contacts", "activities", "properties", "statistics", "legacyReview", "__proto__", "javascript:alert(1)"]) {
    assert.equal(commercialHrefForTab(tab), null, String(tab));
  }
});
