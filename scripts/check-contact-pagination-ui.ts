import assert from "node:assert/strict";
import { join } from "node:path";
import type { Page } from "@playwright/test";

// Browser-only synthetic rows, never written to any database. Called by the guarded isolated runner.
export async function checkContactPaginationUi(page: Page, base: string, fixture: Record<string, unknown>, reportDir: string) {
  const contacts = Array.from({ length: 125 }, (_, index) => ({
    ...fixture, id: crypto.randomUUID(), name: `Recette pagination ${String(index + 1).padStart(3, "0")}`,
    email: `pagination-${index + 1}@example.test`, phone: "0600000000", city: index < 23 ? "Hyères" : "Toulon",
    archived: false, qualification_status: "TO_REVIEW", active_prospect: false, pipeline_lead_id: null,
  }));
  await page.route("**/api/admin/leads", route => route.request().method() === "GET"
    ? route.fulfill({ json: { success: true, contacts, estimations: [], activities: [] } })
    : route.continue());
  try {
    await page.goto(`${base}/admin?tab=contacts`, { waitUntil: "domcontentloaded" });
    const nav = page.getByRole("navigation", { name: "Pagination des contacts" });
    await nav.waitFor({ timeout: 60000 });
    const size = nav.getByLabel("Contacts par page"), jump = nav.getByLabel("Aller à la page");
    const rows = page.locator("table tbody tr");
    assert.equal(await rows.count(), 20);
    for (const amount of [10, 50, 100, 20]) {
      await size.selectOption(String(amount));
      assert.equal(await rows.count(), amount);
      assert.equal(await jump.inputValue(), "1");
    }
    await jump.selectOption("7");
    assert.equal(await rows.count(), 5);
    assert.equal(await nav.getByRole("button", { name: "Suivant", exact: true }).isDisabled(), true);
    await nav.getByRole("button", { name: "Précédent", exact: true }).click();
    assert.equal(await jump.inputValue(), "6");
    await nav.getByRole("button", { name: "Page 1", exact: true }).click();
    assert.equal(await rows.count(), 20);
    await jump.selectOption("6");
    await page.getByRole("textbox", { name: "Rechercher un contact", exact: true }).fill("hyeres");
    assert.equal(await jump.inputValue(), "1");
    assert.match(await nav.innerText(), /23 contacts/);
    await jump.selectOption("2");
    assert.equal(await rows.count(), 3);
    await size.selectOption("50");
    assert.equal(await rows.count(), 23);
    assert.equal(await jump.inputValue(), "1");
    await page.getByRole("textbox", { name: "Rechercher un contact", exact: true }).fill("Aucun résultat pagination");
    await page.getByText("Aucun résultat", { exact: true }).waitFor();
    assert.equal(await nav.count(), 0);
    await page.getByRole("button", { name: "Réinitialiser", exact: true }).click();
    assert.equal(await size.inputValue(), "50");
    await size.selectOption("10");
    await page.getByRole("button", { name: "Vue cartes", exact: true }).click();
    assert.equal(await page.getByRole("heading", { name: /^Recette pagination/ }).count(), 10);
    await jump.selectOption("13");
    assert.equal(await page.getByRole("heading", { name: /^Recette pagination/ }).count(), 5);
    for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await nav.scrollIntoViewIfNeeded();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Horizontal overflow ${width}`);
      await nav.screenshot({ path: join(reportDir, `pagination-${width}.png`) });
    }
  } finally {
    await page.unroute("**/api/admin/leads");
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
}
