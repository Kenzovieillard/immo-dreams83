# Documentation IMMO-DREAMS83

Cette carte relie ta separation mentale aux fichiers exacts du projet : front, back end, CRM, base de donnees et hebergement Vercel.

Regle importante : le code reste dans l'architecture Next.js actuelle. On sectorise la lecture, la documentation et les responsabilites sans deplacer `src/`, `supabase/`, `.vercel/` ou `scripts/`.

## Vue rapide

| Secteur | Documentation | Code et fichiers cles |
| --- | --- | --- |
| Frontend | `docs/frontend/` | `src/app/`, `src/components/`, `public/images/`, `src/app/globals.css` |
| Backend | `docs/backend/` | `src/app/api/`, `src/lib/`, `scripts/` |
| CRM | `docs/crm/` | `src/app/admin/`, `src/components/admin/`, `src/lib/crm.ts`, `src/types/crm.ts` |
| Base de donnees | `docs/database/` | `supabase/schema.sql`, `supabase/migrations/`, `src/lib/supabase.ts`, `src/lib/schema.ts` |
| Vercel / hebergement | `docs/deployment/` | `.vercel/`, `next.config.ts`, `.env.example`, `package.json` |

## Frontend

Dossier documentation : `docs/frontend/`

Ce secteur couvre ce que les visiteurs et admins voient : pages, composants, responsive, design system, assets et experience utilisateur.

Routes publiques :

- `/` : `src/app/page.tsx`
- `/a-vendre` : `src/app/a-vendre/page.tsx`
- `/biens` : `src/app/biens/page.tsx`
- `/biens/[slug]` : `src/app/biens/[slug]/page.tsx`
- `/agence` : `src/app/agence/page.tsx`
- `/contact` : `src/app/contact/page.tsx`
- `/estimation` : `src/app/estimation/page.tsx`
- `/mentions-legales` : `src/app/mentions-legales/page.tsx`
- `/legal/cookies` : `src/app/legal/cookies/page.tsx`
- `/legal/privacy-policy` : `src/app/legal/privacy-policy/page.tsx`

Structure globale :

- `src/app/layout.tsx` : layout global.
- `src/app/globals.css` : styles globaux.
- `src/app/loading.tsx` : etat de chargement global.
- `src/app/error.tsx` : etat d'erreur global.
- `src/app/robots.ts` : robots.txt dynamique.
- `src/app/sitemap.ts` : sitemap dynamique.

Composants front principaux :

- `src/components/site/riviera-home-hero.tsx` : hero principal Riviera.
- `src/components/site/riviera-page-hero.tsx` : hero de page.
- `src/components/site/navbar.tsx` et `src/components/site/footer.tsx` : navigation et pied de page.
- `src/components/site/property-listing-browser.tsx` : navigation des biens.
- `src/components/site/property-card.tsx` : carte de bien.
- `src/components/site/property-gallery.tsx` : galerie de bien.
- `src/components/site/property-search.tsx` : recherche de biens.
- `src/components/forms/contact-form.tsx` : formulaire contact.
- `src/components/forms/estimation-form.tsx` : formulaire estimation.
- `src/components/forms/property-lead-form.tsx` : formulaire lead sur bien.
- `src/components/ui/` : composants UI generiques.

Assets :

- `public/images/` : images publiques du site.
- `public/images/hero/` : images hero, dont les visuels Riviera.

## Backend

Dossier documentation : `docs/backend/`

Ce secteur couvre la logique serveur : routes API Next.js, validation, acces donnees, emails, imports et traitements.

Routes API :

- `src/app/api/contact/route.ts` : creation de demandes contact.
- `src/app/api/estimation/route.ts` : creation de demandes d'estimation.
- `src/app/api/admin/leads/route.ts` : operations admin sur les leads.
- `src/app/api/admin/pipeline/route.ts` : pipeline commercial.
- `src/app/api/admin/properties/route.ts` : gestion admin des biens.
- `src/app/api/admin/property-photos/route.ts` : photos de biens.
- `src/app/api/admin/legacy-review/route.ts` : revue d'import legacy.

Librairies serveur et metier :

- `src/lib/supabase.ts` : client Supabase.
- `src/lib/admin-auth.ts` : logique d'auth admin.
- `src/lib/lead-validation.ts` : validation des leads.
- `src/lib/email-service.ts` : service email.
- `src/lib/property-management.ts` : gestion des biens cote admin.
- `src/lib/public-properties.ts` : lecture publique des biens.
- `src/lib/legacy-crm-review.ts` : revue des donnees legacy.
- `src/lib/dpe.ts` : logique DPE.
- `src/lib/utils.ts` : helpers generiques.

Scripts techniques :

- `scripts/import-static-properties.ts` : import de biens statiques.
- `scripts/audit-lesty-exports.ts` : audit exports Lesty.
- `scripts/dry-run-lesty-properties.ts` : simulation/import biens Lesty.
- `scripts/import-lesty-contacts.ts` : simulation/import contacts Lesty.
- `scripts/dry-run-legacy-crm.ts` : simulation CRM legacy.
- `scripts/migrate-legacy-crm.ts` : migration CRM legacy.

## CRM

Dossier documentation : `docs/crm/`

Ce secteur couvre le metier immobilier : contacts, prospects, leads, pipeline, qualification, rappels, activites et pilotage commercial.

Routes et ecrans CRM confirmes :

- `/admin` : `src/app/admin/page.tsx`
- `/admin/login` : `src/app/admin/login/page.tsx`

Zones de travail CRM presentes dans l'arborescence :

- `src/app/crm-preview/`
- `src/app/crm-preview-qa/`
- `src/app/admin/crm-preview-qa/`
- `src/app/__crm-preview/`

Composants CRM :

- `src/components/admin/admin-dashboard.tsx` : tableau de bord admin.
- `src/components/admin/admin-login-form.tsx` : connexion admin.
- `src/components/admin/crm-mobile-navigation.tsx` : navigation CRM mobile.
- `src/components/admin/crm-riviera-header.tsx` : header CRM Riviera.
- `src/components/admin/crm-riviera-overview.tsx` : vue d'ensemble CRM.
- `src/components/admin/crm-riviera-contacts.tsx` : contacts CRM.
- `src/components/admin/crm-riviera-ui.tsx` : primitives UI CRM Riviera.
- `src/components/admin/bento/` : design system Bento admin.

Logique et types CRM :

- `src/lib/crm.ts` : logique CRM principale.
- `src/lib/crm-dashboard.ts` : donnees du dashboard CRM.
- `src/types/crm.ts` : types CRM metier.
- `src/types/admin.ts` : types admin.

Docs CRM existantes :

- `docs/crm/CRM_CONTACT_QUALIFICATION.md`
- `docs/crm/CRM_V3_IMPLEMENTATION.md`
- `docs/crm/V2_5_RECETTE.md`
- `docs/crm/V2_6_RECETTE.md`
- `docs/crm/V3.md`
- `docs/crm/V3_PHASE_3_CRM_COMMERCIAL.md`

## Base de donnees

Dossier documentation : `docs/database/`

Ce secteur couvre Supabase : schema, migrations, tables, RLS, imports et synchronisation avec les types applicatifs.

Fichiers Supabase :

- `supabase/schema.sql` : schema global.
- `supabase/migrations/202607150001_v3_secure_crm_foundation.sql`
- `supabase/migrations/202607150002_property_source_of_truth.sql`
- `supabase/migrations/202607160001_leads_data_model_foundation.sql`
- `supabase/migrations/202607160002_legacy_lead_import_guardrails.sql`
- `supabase/migrations/202607160003_commercial_pipeline_foundation.sql`
- `supabase/migrations/202607160004_crm_reminder_automation.sql`
- `supabase/migrations/202607160005_lesty_property_types.sql`
- `supabase/migrations/202607260001_contact_qualification_daily_crm.sql`

Tables principales vues dans `supabase/schema.sql` :

- Donnees publiques et demandes : `contacts`, `estimations`, `properties`, `property_photos`, `activities`.
- CRM commercial : `leads`, `lead_status_history`, `tasks`, `communications`, `appointments`.
- Mandats et rapprochements : `mandates`, `buyer_searches`, `match_suggestions`.
- Admin et audit : `profiles`, `audit_logs`, `property_versions`, `property_history`, `property_slug_history`, `property_photo_trash`.
- Imports et exports : `email_events`, `analytics_snapshots`, `portal_exports`, `portal_export_logs`.

Fichiers applicatifs relies :

- `src/lib/supabase.ts` : connexion a Supabase.
- `src/lib/schema.ts` : schema/types applicatifs.
- `src/types/crm.ts` : types CRM utilises par le front et le back.
- `docs/database/PROPERTY_IMPORTS.md` : inventaire et logique d'import des annonces.

## Hebergement Vercel

Dossier documentation : `docs/deployment/`

Ce secteur couvre l'execution en local, le build, les variables d'environnement et Vercel.

Fichiers de configuration :

- `.vercel/` : liaison locale au projet Vercel.
- `.vercel/project.json` : identifiants du projet Vercel local.
- `next.config.ts` : configuration Next.js.
- `.env.example` : modele des variables d'environnement.
- `.env.local` : variables locales, a ne pas exposer.
- `package.json` : scripts npm et dependances.
- `package-lock.json` : verrouillage des dependances.

Scripts npm importants :

- `npm run dev` : serveur local.
- `npm run build` : build de production.
- `npm run start` : demarrage apres build.
- `npm run lint` : controle lint.
- `npm run properties:import:dry-run` : simulation d'import biens.
- `npm run properties:import` : import biens applique.
- `npm run lesty:audit` : audit Lesty.
- `npm run crm:legacy-dry-run` : simulation CRM legacy.
- `npm run crm:legacy-migrate` : migration CRM legacy appliquee.

## Rapports

Dossier : `reports/`

- `reports/imports/dry-runs/` : simulations et tests d'import.
- `reports/imports/applied/` : imports ou migrations appliquees.
- `reports/audits/` : audits, controles et logs techniques.
- `reports/audits/dev-server-logs/` : logs de serveurs de developpement ranges hors racine.

## Methode de travail

Pour modifier une fonctionnalite, utiliser cette lecture :

1. Identifier le secteur dominant : front, backend, CRM, database ou deployment.
2. Lire le README du secteur dans `docs/<secteur>/`.
3. Localiser les fichiers exacts dans cette carte.
4. Modifier le minimum de fichiers necessaires.
5. Lancer au moins `npm run lint` et, si l'impact est applicatif, `npm run build`.
