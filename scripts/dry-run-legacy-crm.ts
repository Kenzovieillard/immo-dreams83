import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildLegacyCrmReviewReport,
  type LegacyContactRow,
  type LegacyEstimationRow,
} from "../src/lib/legacy-crm-review";

const writeReport = process.argv.includes("--write-report");
const reportDir = join(process.cwd(), "reports");

function loadLocalEnv() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

function saveReport(report: unknown) {
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `legacy-crm-dry-run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

async function main() {
  loadLocalEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const report = {
      success: false,
      mode: "dry-run",
      generatedAt: new Date().toISOString(),
      blockedReason: "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans l'environnement local.",
      writesPerformed: false,
      actionsRequired: [
        "Renseigner .env.local avec les variables Supabase de test.",
        "Relancer npm run crm:legacy-dry-run.",
        "Ajouter --write-report pour conserver un JSON local non suivi par Git.",
      ],
    };

    if (writeReport) {
      const reportPath = saveReport(report);
      console.log(`Legacy CRM dry-run report written: ${reportPath}`);
    }

    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [contactsResult, estimationsResult] = await Promise.all([
    supabase
      .from("contacts")
      .select("id,created_at,updated_at,name,email,phone,request_type,city,message,status,notes,archived")
      .order("created_at", { ascending: true }),
    supabase
      .from("estimations")
      .select("id,created_at,updated_at,name,email,phone,property_type,city,postal_code,surface,rooms,message,status,notes,archived")
      .order("created_at", { ascending: true }),
  ]);

  if (contactsResult.error) throw new Error(`Contacts read failed: ${contactsResult.error.message}`);
  if (estimationsResult.error) throw new Error(`Estimations read failed: ${estimationsResult.error.message}`);

  const contacts = (contactsResult.data ?? []) as LegacyContactRow[];
  const estimations = (estimationsResult.data ?? []) as LegacyEstimationRow[];
  const report = buildLegacyCrmReviewReport(contacts, estimations);

  if (writeReport) {
    const reportPath = saveReport(report);
    console.log(`Legacy CRM dry-run report written: ${reportPath}`);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);

  if (writeReport) {
    const reportPath = saveReport({
      success: false,
      mode: "dry-run",
      generatedAt: new Date().toISOString(),
      writesPerformed: false,
      error: message,
      actionsRequired: [
        "Verifier que .env.local cible bien l'environnement Supabase de test.",
        "Verifier l'acces reseau au projet Supabase depuis ce poste.",
        "Relancer npm run crm:legacy-dry-run -- --write-report avant toute migration Partie 3.",
      ],
    });
    console.error(`Legacy CRM dry-run failed. Failure report written: ${reportPath}`);
  }

  console.error(message);
  process.exit(1);
});
