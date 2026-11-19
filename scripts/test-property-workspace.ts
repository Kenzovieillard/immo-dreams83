import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { expect, type BrowserContext } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Property } from "../src/data/properties";
import { propertyMutationPayload } from "../src/lib/property-workspace";
import type { Database } from "../src/types/supabase";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5kYAAAAASUVORK5CYII=",
  "base64",
);

export async function verifyPropertyWorkspace({
  browserContext,
  readOnlyContext,
  supabase,
  anonymous,
  baseUrl,
  runId,
  adminId,
  ownerId,
  buyerId,
  runSql,
  record,
}: {
  browserContext: BrowserContext;
  readOnlyContext: BrowserContext;
  supabase: SupabaseClient<Database>;
  anonymous: SupabaseClient<Database>;
  baseUrl: string;
  runId: string;
  adminId: string;
  ownerId: string;
  buyerId: string;
  runSql: (sql: string) => void;
  record: (check: string, evidence: string) => void;
}) {
  const title = `${runId} Villa de recette`;
  const url = `${baseUrl}/admin?tab=properties`;
  const page = await browserContext.newPage();
  const wizard = page.getByRole("region", { name: "Création d’un bien" });
  const request = browserContext.request;
  const errors: string[] = [];
  const uploads: string[] = [];
  const output = "work/property-workspace-qa";
  await mkdir(output, { recursive: true });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({ contentType: "image/png", body: tinyPng }),
  );
  let propertyId: string | undefined;
  let disposableId: string | undefined;
  try {
    await page.goto(url);
    await page
      .getByRole("button", { name: "Ajouter un bien", exact: true })
      .click();
    await page.getByLabel("Titre commercial *").fill(title);
    await page.getByLabel("Prix affiché (€) *").fill("450000");
    await page.getByLabel("Honoraires renseignés (€)").fill("22000");
    await page.getByLabel("Référence du mandat").fill(`${runId}-MANDAT`);
    await page.getByLabel("Type de mandat prévu").selectOption("exclusive");
    await page
      .getByLabel("Propriétaire", { exact: true })
      .selectOption(ownerId);
    await wizard.getByLabel("Conseiller responsable").selectOption(adminId);
    await wizard.getByRole("button", { name: /Médias/ }).click();
    await page.getByLabel(/Ajouter les photos/).setInputFiles({
      name: `${runId}-1.png`,
      mimeType: "image/png",
      buffer: tinyPng,
    });
    const assetsRoute = "**/api/admin/properties/drafts/assets?*";
    await page.route(assetsRoute, (route) =>
      route.fulfill({
        status: 503,
        json: { success: false, message: "Envoi interrompu pour la recette." },
      }),
    );
    await wizard
      .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
      .click();
    await expect(wizard.getByRole("alert")).toContainText(
      "Envoi interrompu pour la recette.",
    );
    const unsaved = await supabase
      .from("property_drafts")
      .select("id")
      .eq("author_id", adminId);
    assert.ifError(unsaved.error);
    assert.equal(unsaved.data.length, 0);
    await page.unroute(assetsRoute);
    await wizard.getByRole("button", { name: /Informations/ }).click();
    await page
      .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Votre brouillon est enregistré" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Continuer la saisie", exact: true })
      .click();
    const draft = await supabase
      .from("property_drafts")
      .select("*")
      .eq("author_id", adminId)
      .single();
    assert.ifError(draft.error);
    propertyId = draft.data.id;
    const draftRequest = await readOnlyContext.request.get(
      `${baseUrl}/api/admin/properties/drafts`,
    );
    assert.equal(draftRequest.status(), 403);
    await page.reload();
    await page.getByRole("button", { name: /Brouillons en cours/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Reprendre", exact: true })
      .click();
    await expect(page.getByLabel("Titre commercial *")).toHaveValue(title);
    await expect(page.getByLabel("Propriétaire", { exact: true })).toHaveValue(
      ownerId,
    );
    record(
      "Biens · Brouillon",
      "échec d’envoi sans brouillon partiel, reprise après rechargement, propriétaire et conseiller conservés, lecture seule refusée",
    );

    const next = () =>
      page.getByRole("button", { name: "Continuer", exact: true }).click();
    await next();
    await page.getByLabel("Commune *").fill("Toulon");
    await page.getByLabel("Code postal *").fill("83000");
    await page
      .getByLabel("Adresse exacte (interne)")
      .fill("Adresse privée de recette");
    // This fixture deliberately has no exact coordinates to verify the commune map.
    await next();
    await page.getByLabel("Surface du bien (m²) *").fill("120");
    await page.getByLabel("Chambres", { exact: true }).fill("3");
    await page
      .getByRole("button", { name: "Ajouter une pièce", exact: true })
      .click();
    await page.getByLabel("Pièce 1", { exact: true }).fill("Séjour");
    await page.getByLabel("Surface pièce 1 (m²)", { exact: true }).fill("35");
    await page.getByLabel("Copropriété", { exact: true }).selectOption("no");
    await page.getByLabel("Taxe foncière annuelle (€)").fill("1850");
    await next();
    await page.getByLabel("Énergie (kWhEP/m²/an)").fill("115");
    await page.getByLabel("Climat (kg CO₂/m²/an)").fill("14");
    await page.getByLabel("Diagnostiqueur").fill("Diagnostiqueur de recette");
    await next();
    const photos = Array.from({ length: 5 }, (_, index) => ({
      name: `${runId}-${index + 1}.png`,
      mimeType: "image/png",
      buffer: tinyPng,
    }));
    await page
      .getByLabel(/Ajouter les photos/)
      .setInputFiles(photos.slice(1, 2));
    await next();
    await page
      .getByLabel("Description courte *")
      .fill("Description de recette sur la base isolée.");
    await next();
    await page.getByLabel(/Ajouter un document privé/).setInputFiles({
      name: `${runId}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from(`%PDF-1.4\n${runId}\n%%EOF\n`),
    });
    await page.getByLabel(/Catégorie de/).selectOption("diagnostic");
    await next();
    await expect(
      page.getByText("Dossier à compléter — publication indisponible", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Publier sur le site", exact: true }),
    ).toHaveCount(0);
    const incomplete = page.getByRole("button", {
      name: "3 photo(s) à ajouter",
      exact: true,
    });
    await expect(incomplete).toBeVisible();
    await page.setViewportSize({ width: 390, height: 950 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "wizard overflows at 390 px",
    );
    await page.screenshot({
      path: `${output}/creation-mobile.png`,
      fullPage: true,
    });
    await incomplete.click();
    await page.getByLabel(/Ajouter les photos/).setInputFiles(photos.slice(2));
    const previews = page
      .getByRole("list", { name: "Photos sélectionnées" })
      .locator("img");
    await expect(previews).toHaveCount(5);
    for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `media step overflows at ${width}px`,
      );
      const previewHeights = await previews.evaluateAll((images) =>
        images.map((image) => image.getBoundingClientRect().height),
      );
      assert(
        previewHeights.every((height) => height >= 79),
        `gallery previews collapse at ${width}px`,
      );
    }
    await page.screenshot({
      path: `${output}/medias-desktop.png`,
      fullPage: true,
    });
    await next();
    await next();
    const documentBytes = Buffer.from(`%PDF-1.4\n${runId}\n%%EOF\n`);
    await page.getByLabel(/Ajouter un document privé/).setInputFiles([
      {
        name: "titre-recette.pdf",
        mimeType: "application/pdf",
        buffer: documentBytes,
      },
      {
        name: "cadastre-recette.pdf",
        mimeType: "application/pdf",
        buffer: documentBytes,
      },
    ]);
    await page
      .getByLabel("Catégorie de titre-recette.pdf", { exact: true })
      .selectOption("ownership");
    await page
      .getByLabel("Catégorie de cadastre-recette.pdf", { exact: true })
      .selectOption("cadastral_plan");
    await wizard
      .getByRole("button", { name: "Retour aux biens", exact: true })
      .click();
    const leave = page.getByRole("dialog", {
      name: "Quitter la création du bien ?",
    });
    await expect(leave).toBeVisible();
    await leave.getByRole("button", { name: "Continuer la saisie" }).click();
    await expect(
      page.getByLabel("Catégorie de cadastre-recette.pdf", { exact: true }),
    ).toHaveValue("cadastral_plan");
    await wizard
      .getByRole("button", { name: "Retour aux biens", exact: true })
      .click();
    await leave
      .getByRole("button", { name: "Enregistrer le brouillon et quitter" })
      .click();
    await expect(
      page.getByRole("button", { name: /Brouillons en cours/ }),
    ).toBeVisible({ timeout: 60_000 });
    await page.reload();
    await page.getByRole("button", { name: /Brouillons en cours/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Reprendre", exact: true })
      .click();
    await expect(
      page.getByLabel("Catégorie de cadastre-recette.pdf", { exact: true }),
    ).toHaveValue("cadastral_plan");
    await page.getByRole("button", { name: "Précédent", exact: true }).click();
    const description = page.getByLabel("Description courte *");
    await expect(description).toHaveValue(
      "Description de recette sur la base isolée.",
    );
    await description.fill("Modification à abandonner.");
    await page
      .getByRole("link", { name: "Pipeline", exact: true })
      .first()
      .click();
    await leave.getByRole("button", { name: "Continuer la saisie" }).click();
    await expect(description).toHaveValue("Modification à abandonner.");
    await wizard
      .getByRole("button", { name: "Retour aux biens", exact: true })
      .click();
    await leave
      .getByRole("button", { name: "Quitter sans enregistrer" })
      .click();
    await page.getByRole("button", { name: /Brouillons en cours/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Reprendre", exact: true })
      .click();
    await page.getByRole("button", { name: "Précédent", exact: true }).click();
    await expect(description).toHaveValue(
      "Description de recette sur la base isolée.",
    );
    await next();
    await next();
    await expect(
      page.getByText("5 photo(s) sur 5 requises", { exact: false }),
    ).toBeVisible();
    record(
      "Biens · Sortie et reprise",
      "confirmation, sauvegarde des cinq photos et trois PDF, reprise après rechargement",
    );
    const photoSent = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/admin/property-photos") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Publier sur le site", exact: true })
      .click();
    const photoResponse = await photoSent;
    const photoData = await photoResponse.json();
    assert.equal(photoResponse.status(), 200);
    for (const item of photoData.photos ?? []) uploads.push(item.path);
    await expect(
      page.getByRole("status").filter({ hasText: "Bien publié sur le site." }),
    ).toBeVisible({ timeout: 60_000 });
    const saved = await supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .single();
    assert.ifError(saved.error);
    assert.equal(saved.data.publication_status, "PUBLISHED");
    assert.equal(saved.data.owner_contact_id, ownerId);
    assert.equal(saved.data.advisor_id, adminId);
    assert.equal(saved.data.street_address, "Adresse privée de recette");
    assert.equal(saved.data.latitude, null);
    assert.equal(saved.data.longitude, null);
    assert.deepEqual(
      (
        saved.data.workspace_details as {
          roomDetails: Array<{ label: string; surface: string }>;
        }
      ).roomDetails,
      [{ label: "Séjour", surface: "35" }],
    );
    const publicRow = await anonymous
      .from("public_properties")
      .select("*")
      .eq("id", propertyId)
      .single();
    assert.ifError(publicRow.error);
    assert.equal(publicRow.data.title, title);
    for (const field of [
      "street_address",
      "owner_contact_id",
      "advisor_id",
      "latitude",
      "longitude",
      "workspace_details",
    ]) {
      assert(!(field in publicRow.data), `${field} must be private`);
    }
    record(
      "Biens · Création et publication",
      "8 étapes, publication empêchée avec deux photos, puis cinq photos et deux pièces obligatoires, adresse privée exclue",
    );

    const panels = page.getByRole("navigation", { name: "Rubriques du bien" });
    const headings = [
      ["Aperçu", "Suivi commercial"],
      ["Informations", "Caractéristiques"],
      ["Médias", "Galerie photos (5)"],
      ["Commercialisation", "Diffusion"],
      ["Acquéreurs", "Acquéreurs compatibles"],
      ["Visites", "Visites liées au bien"],
      ["Offres", "Offres liées au bien"],
      ["Documents", "Documents du bien"],
      ["Activités", "Historique du bien"],
    ];
    const buyer = await supabase.from("buyer_searches").insert({
      contact_id: buyerId,
      assigned_to: adminId,
      property_types: ["house"],
      cities: ["Toulon"],
      max_budget: 500000,
      min_surface: 100,
    });
    assert.ifError(buyer.error);
    await page.reload();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: `${runId} Vendeur`, exact: true }),
    ).toBeVisible();
    const cover = page.getByRole("button", {
      name: "Agrandir la photo principale",
      exact: true,
    });
    assert(
      (await cover.boundingBox())!.height >= 192,
      "the cover should hold its designed height",
    );
    await page.screenshot({
      path: `${output}/fiche-desktop.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 950 });
    for (const [tab, heading] of headings) {
      await panels.getByRole("button", { name: tab, exact: true }).click();
      await expect(
        page.getByRole("heading", { name: heading, exact: true }).first(),
      ).toBeVisible();
    }
    await panels
      .getByRole("button", { name: "Acquéreurs", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: `${runId} Acquéreur`, exact: true }),
    ).toBeVisible();
    await panels
      .getByRole("button", { name: "Documents", exact: true })
      .click();
    const documentLink = page.getByRole("link", {
      name: `Télécharger ${runId}.pdf`,
      exact: true,
    });
    await expect(documentLink).toBeVisible();
    await page
      .getByLabel("Nom du nouveau dossier")
      .fill("Diagnostics complémentaires");
    await page
      .getByRole("button", { name: "Créer un dossier", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Diagnostics complémentaires",
        exact: true,
      }),
    ).toBeVisible({ timeout: 15_000 });
    const downloadHref = await documentLink.getAttribute("href");
    assert(downloadHref);
    const unauthorized = await fetch(baseUrl + downloadHref, {
      redirect: "manual",
    });
    assert.equal(unauthorized.status, 401);
    const download = await request.get(baseUrl + downloadHref);
    assert.equal(download.status(), 200);
    assert.match((await download.body()).subarray(0, 5).toString(), /^%PDF-$/);
    page.once("dialog", (dialog) => dialog.accept());
    await documentLink
      .locator("..")
      .getByRole("button", { name: "Archiver", exact: true })
      .click();
    await expect(documentLink).toHaveCount(0, { timeout: 15_000 });
    record(
      "Biens · Fiche et documents",
      "9 onglets, rapprochement réel, création de dossier, lecture anonyme refusée, téléchargement signé et archivage",
    );

    await page
      .getByRole("button", { name: "Retour aux biens", exact: true })
      .first()
      .click();
    const search = page.getByRole("textbox", { name: "Rechercher un bien" });
    await search.fill(runId);
    const viewButtons = page.getByRole("group", { name: "Mode d’affichage" });
    for (const view of ["Galerie", "Tableau", "Carte", "Liste compacte"]) {
      await viewButtons
        .getByRole("button", { name: view, exact: true })
        .click();
      if (view === "Carte") {
        const marker = page.getByRole("button", {
          name: "Toulon · 1 bien",
          exact: true,
        });
        await expect(marker).toBeVisible({ timeout: 15_000 });
        await marker.click();
        await expect(
          page.getByRole("heading", { name: "Toulon (1)", exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Toutes les communes", exact: true })
          .click();
        await marker.press("Space");
        await expect(
          page.getByRole("heading", { name: "Toulon (1)", exact: true }),
        ).toBeVisible();
        await expect(marker).toHaveAttribute("aria-pressed", "true");
        await page
          .getByRole("button", { name: "Toutes les communes", exact: true })
          .click();
        await page.getByRole("button", { name: /^Toulon\s*1$/ }).click();
        await expect(
          page.getByRole("heading", { name: "Toulon (1)", exact: true }),
        ).toBeVisible();
      }
      await expect(
        page.getByRole("button", { name: title, exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: `Gérer ${title}`, exact: true })
        .click();
      const actions = page.getByRole("dialog", { name: "Actions du bien" });
      await expect(actions.getByText(title, { exact: false })).toBeVisible();
      await actions.getByRole("button", { name: "Fermer" }).click();
      if (view === "Tableau") {
        await page
          .getByRole("checkbox", { name: `Sélectionner ${title}` })
          .check();
        await expect(
          page.getByText("1 sélectionné(s)", { exact: false }),
        ).toBeVisible();
      }
      for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 960 });
        const viewport = await page.evaluate(() => ({
          screen: innerWidth,
          page: document.documentElement.scrollWidth,
        }));
        if (viewport.page > viewport.screen + 1) {
          await page.screenshot({
            path: `${output}/overflow.png`,
            fullPage: true,
          });
          throw new Error(
            `${view} overflows at ${width} px: ${viewport.page} px`,
          );
        }
      }
      if (view === "Tableau")
        await page.screenshot({
          path: `${output}/portefeuille-desktop.png`,
          fullPage: true,
        });
      if (view === "Carte") {
        await page.screenshot({
          path: `${output}/carte-communes-desktop.png`,
          fullPage: true,
        });
      }
    }
    await page.getByRole("button", { name: title, exact: true }).click();
    const propertySheet = page.getByRole("region", { name: "Fiche bien" });
    await expect(
      propertySheet.getByRole("button", {
        name: "Retour aux biens",
        exact: true,
      }),
    ).toHaveCount(2);
    await propertySheet
      .getByRole("button", { name: "Retour aux biens", exact: true })
      .last()
      .click();
    await expect(search).toHaveValue(runId);
    await expect(
      viewButtons.getByRole("button", { name: "Liste compacte", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: `Gérer ${title}`, exact: true })
      .click();
    const actions = page.getByRole("dialog", { name: "Actions du bien" });
    await actions.getByRole("button", { name: "Réservé", exact: true }).click();
    await expect(
      actions.getByRole("button", { name: "Réservé", exact: true }),
    ).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
    await expect(actions.getByText("Publié", { exact: true })).toBeVisible();
    await actions
      .getByRole("button", { name: "Mettre à la une", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Retirer de la une", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    const home = await fetch(baseUrl);
    assert(
      (await home.text()).includes(title),
      "featured property is missing from the home page",
    );
    await actions
      .getByRole("button", { name: "Supprimer", exact: true })
      .click();
    const confirmation = page.getByRole("dialog", {
      name: "Supprimer ce bien ?",
    });
    await confirmation
      .getByRole("button", { name: "Annuler", exact: true })
      .click();
    await expect(actions).toBeVisible();
    await actions
      .getByRole("button", { name: "Archiver", exact: true })
      .click();
    const archived = page.getByRole("dialog", { name: "Bien archivé" });
    await expect(archived).toBeVisible({ timeout: 15_000 });
    assert(
      !(await (await fetch(baseUrl)).text()).includes(title),
      "archived property is shown on the home page",
    );
    await archived
      .getByRole("button", { name: "Annuler l’archivage", exact: true })
      .click();
    await expect(actions.getByText("Bien restauré en brouillon.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(actions.getByText("Absent de la une")).toBeVisible();
    await actions
      .getByRole("button", { name: "Publier sur le site", exact: true })
      .click();
    await expect(actions.getByText("Bien publié sur le site.")).toBeVisible({
      timeout: 15_000,
    });
    await actions.getByRole("button", { name: "Fermer" }).click();
    const payload = await request.get(`${baseUrl}/api/admin/properties`);
    assert.equal(payload.status(), 200);
    const catalogue = (await payload.json()) as { properties: Property[] };
    const property = catalogue.properties.find(
      (item) => item.id === propertyId,
    );
    assert(property);
    const blockedDelete = await request.delete(
      `${baseUrl}/api/admin/properties/${propertyId}/actions`,
      {
        data: { expectedUpdatedAt: property.updatedAt, confirm: true },
      },
    );
    assert.equal(blockedDelete.status(), 409);
    const disposableTitle = `${runId} Bien à supprimer`;
    const disposable = await request.post(`${baseUrl}/api/admin/properties`, {
      data: {
        ...propertyMutationPayload({
          ...property,
          title: disposableTitle,
          publicationStatus: "DRAFT",
          featured: false,
          photos: [],
        }),
        reference: "",
      },
    });
    assert.equal(disposable.status(), 200);
    const disposableProperty = (
      (await disposable.json()) as { property: Property }
    ).property;
    disposableId = disposableProperty.id;
    const disposableEndpoint = `${baseUrl}/api/admin/properties/${disposableId}/actions`;
    const missingConfirmation = await request.delete(disposableEndpoint, {
      data: { expectedUpdatedAt: disposableProperty.updatedAt },
    });
    assert.equal(missingConfirmation.status(), 400);
    const deniedDelete = await readOnlyContext.request.delete(
      disposableEndpoint,
      {
        data: {
          expectedUpdatedAt: disposableProperty.updatedAt,
          confirm: true,
        },
      },
    );
    assert.equal(deniedDelete.status(), 403);
    const incompletePublish = await request.patch(disposableEndpoint, {
      data: {
        expectedUpdatedAt: disposableProperty.updatedAt,
        action: "publish",
      },
    });
    assert.equal(incompletePublish.status(), 422);
    assert.match((await incompletePublish.json()).message, /plan cadastral/i);
    await page.reload();
    await page
      .getByRole("textbox", { name: "Rechercher un bien" })
      .fill(disposableTitle);
    await page
      .getByRole("button", { name: `Gérer ${disposableTitle}`, exact: true })
      .click();
    await actions
      .getByRole("button", { name: "Supprimer", exact: true })
      .click();
    await confirmation
      .getByRole("button", { name: "Supprimer définitivement", exact: true })
      .click();
    const deleted = page.getByRole("dialog", { name: "Bien supprimé" });
    await expect(deleted).toBeVisible({ timeout: 15_000 });
    await deleted
      .getByRole("button", { name: "Retour aux biens", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: disposableTitle, exact: true }),
    ).toHaveCount(0);
    const removed = await supabase
      .from("properties")
      .select("id")
      .eq("id", disposableId)
      .maybeSingle();
    assert.ifError(removed.error);
    assert.equal(removed.data, null);
    record(
      "Biens · Suppression",
      "confirmation requise, lecture seule refusée, dossier lié bloqué, suppression définitive vérifiée sur un dossier isolé",
    );
    const patch = propertyMutationPayload({
      ...property,
      title: title + " modifiée",
    });
    const accepted = await request.patch(`${baseUrl}/api/admin/properties`, {
      data: patch,
    });
    assert.equal(accepted.status(), 200);
    const stale = await request.patch(`${baseUrl}/api/admin/properties`, {
      data: patch,
    });
    assert.equal(stale.status(), 409);
    const denied = await readOnlyContext.request.patch(
      `${baseUrl}/api/admin/properties`,
      { data: patch },
    );
    assert.equal(denied.status(), 403);
    assert.deepEqual(errors, []);
    record(
      "Biens · Portefeuille et droits",
      "quatre vues et même filtre, carte par commune sans coordonnées privées, sélection, vedette, sept largeurs et conflit 409",
    );

    const edited = (await accepted.json()) as { property: Property };
    const unpublished = await request.patch(`${baseUrl}/api/admin/properties`, {
      data: propertyMutationPayload({
        ...edited.property,
        publicationStatus: "UNPUBLISHED",
      }),
    });
    assert.equal(unpublished.status(), 200);
    const revision = ((await unpublished.json()) as { property: Property })
      .property.updatedAt;
    const publicationUrl = `${baseUrl}/api/admin/properties/${propertyId}/publication`;
    const past = await request.patch(publicationUrl, {
      data: {
        scheduledAt: new Date(Date.now() - 60_000).toISOString(),
        expectedUpdatedAt: revision,
      },
    });
    assert.equal(past.status(), 400);
    const schedule = await request.patch(publicationUrl, {
      data: {
        scheduledAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        expectedUpdatedAt: revision,
      },
    });
    assert.equal(schedule.status(), 200);
    const stillPrivate = await anonymous
      .from("public_properties")
      .select("id")
      .eq("id", propertyId)
      .maybeSingle();
    assert.ifError(stillPrivate.error);
    assert.equal(stillPrivate.data, null);
    runSql(`update public.property_documents set archived_at=now() where property_id='${propertyId}' and kind='cadastral_plan';
      update public.properties set scheduled_publication_at=now() - interval '1 minute' where id='${propertyId}';
      select public.run_scheduled_property_publications();`);
    const blockedSchedule = await supabase
      .from("properties")
      .select("publication_status,publication_schedule_error,updated_at")
      .eq("id", propertyId)
      .single();
    assert.ifError(blockedSchedule.error);
    assert.equal(blockedSchedule.data.publication_status, "UNPUBLISHED");
    assert.match(
      blockedSchedule.data.publication_schedule_error ?? "",
      /plan cadastral/i,
    );
    runSql(
      `update public.property_documents set archived_at=null where property_id='${propertyId}' and kind='cadastral_plan';`,
    );
    const rescheduled = await request.patch(publicationUrl, {
      data: {
        scheduledAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        expectedUpdatedAt: blockedSchedule.data.updated_at,
      },
    });
    assert.equal(rescheduled.status(), 200);
    runSql(`update public.properties set scheduled_publication_at = now() - interval '1 minute' where id = '${propertyId}';
      select public.run_scheduled_property_publications();`);
    const published = await anonymous
      .from("public_properties")
      .select("id")
      .eq("id", propertyId)
      .maybeSingle();
    assert.ifError(published.error);
    assert.equal(published.data?.id, propertyId);
    const event = await supabase
      .from("property_history")
      .select("id")
      .eq("property_id", propertyId)
      .eq("action", "property.publication.scheduled")
      .single();
    assert.ifError(event.error);
    record(
      "Biens · Publication programmée",
      "date passée refusée, bien privé avant échéance, retrait d’une pièce recontrôlé, publication et historique ensuite vérifiés",
    );
  } finally {
    await page.close();
    if (disposableId) {
      assert.ifError(
        (
          await supabase
            .from("properties")
            .delete()
            .eq("id", disposableId)
            .eq("created_by", adminId)
        ).error,
      );
    }
    if (propertyId) {
      assert.match(propertyId, /^[a-f0-9-]{36}$/);
      const documents = await supabase
        .from("property_documents")
        .select("storage_path")
        .eq("property_id", propertyId);
      assert.ifError(documents.error);
      if (documents.data.length) {
        const storage = await supabase.storage
          .from("crm-property-documents")
          .remove(documents.data.map((doc) => doc.storage_path));
        assert.ifError(storage.error);
      }
      const photos = await supabase
        .from("property_photos")
        .select("storage_path")
        .eq("property_id", propertyId);
      assert.ifError(photos.error);
      const items = Array.from(
        new Set([
          ...uploads,
          ...photos.data.map((photo) => photo.storage_path),
        ]),
      ).filter((path) => path.startsWith("properties/"));
      if (items.length)
        assert.ifError(
          (await supabase.storage.from("property-photos").remove(items)).error,
        );
      const draftFiles = supabase.storage.from("crm-property-drafts");
      const prefix = `drafts/${adminId}/${propertyId}`;
      const staged = await draftFiles.list(prefix);
      assert.ifError(staged.error);
      if (staged.data.length)
        assert.ifError(
          (
            await draftFiles.remove(
              staged.data.map(({ name }) => `${prefix}/${name}`),
            )
          ).error,
        );
      const orphanPhotos = await supabase.storage
        .from("property-photos")
        .list(`properties/${propertyId}`);
      assert.ifError(orphanPhotos.error);
      if (orphanPhotos.data.length)
        assert.ifError(
          (
            await supabase.storage
              .from("property-photos")
              .remove(
                orphanPhotos.data.map(
                  ({ name }) => `properties/${propertyId}/${name}`,
                ),
              )
          ).error,
        );
      runSql(
        `delete from public.property_documents where property_id = '${propertyId}';`,
      );
      assert.ifError(
        (
          await supabase
            .from("properties")
            .delete()
            .eq("id", propertyId)
            .eq("created_by", adminId)
        ).error,
      );
      assert.ifError(
        (
          await supabase
            .from("property_drafts")
            .delete()
            .eq("id", propertyId)
            .eq("author_id", adminId)
        ).error,
      );
      const remaining = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("id", propertyId);
      assert.ifError(remaining.error);
      assert.equal(remaining.count, 0);
      record(
        "Biens · Nettoyage",
        "bien et brouillon de recette supprimés avec leurs photos et documents",
      );
    }
  }
}
