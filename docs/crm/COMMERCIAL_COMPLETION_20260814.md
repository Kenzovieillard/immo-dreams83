# CRM Commercial — finalisation du socle réel

Date de livraison : 13 août 2026
Migration liée : `202608140001_commercial_remaining.sql`

## Architecture

```text
Pages /commercial/*
→ composants connectés et formulaires React Hook Form + Zod
→ API /api/admin/commercial/{pipeline,estimations,visites,offres}
→ src/lib/commercial-service.ts
→ client Supabase serveur protégé
→ vues, tables et RPC PostgreSQL
```

Les pages de production n'importent plus les écrans de maquette ni leurs fixtures. Les anciens composants `*-screens.tsx`, `commercial-data.ts` et `negotiation-data.ts` sont conservés uniquement pour la route isolée et non indexée `/crm-riviera-commercial-preview`.

## Parcours livrés

- Pipeline : lecture Supabase, filtres, vue équipe, drag-and-drop avec rollback UI, création de dossier, mandat et tâches persistantes, liens intermodules et rafraîchissement périodique.
- Estimations : liste/détail, création et modification, créneau exact, conseiller/contact réels, PDF privé, URL signée et transformation atomique vers bien + dossier vendeur + mandat.
- Visites : liste, calendrier, planification, confirmation, replanification, compte rendu RHF/Zod et suites `CREATE_OFFER`, `PLAN_SECOND_VISIT`, `FOLLOW_UP_LATER`, `NO_FOLLOW_UP`.
- Offres : liste/détail, options réelles, paramètres canoniques et historiques, brouillon distinct de la création, transitions, documents privés et liens intermodules.
- Négociations : lecture et SSE existants préservés, types Supabase restaurés, contre-proposition/décision, documents privés, distinction entre note interne et relance client.

## Contrats API

| Méthode | Route | Responsabilité |
| --- | --- | --- |
| GET | `/api/admin/commercial/pipeline` | Cartes, statistiques, équipe et options réelles |
| POST | `/api/admin/commercial/pipeline` | Étape, dossier, mandat et cycle de vie des tâches |
| GET | `/api/admin/commercial/estimations` | Liste/détail, filtres, options et téléchargement signé du rapport |
| POST | `/api/admin/commercial/estimations` | Création, modification, génération PDF et transformation atomique |
| GET | `/api/admin/commercial/visites` | Liste/détail, calendrier, statistiques et options |
| POST | `/api/admin/commercial/visites` | Planification, statut, replanification et compte rendu |
| GET | `/api/admin/commercial/offres` | Liste/détail, préremplissage et URL signée de document |
| POST | `/api/admin/commercial/offres` | Brouillon/création, statut et upload de document |
| DELETE | `/api/admin/commercial/offres` | Suppression cohérente des métadonnées et du fichier privé |
| GET | `/api/admin/commercial/negotiations` | Hub réel et détail |
| POST | `/api/admin/commercial/negotiations` | Contre-proposition, décision, note interne ou relance client |
| GET/POST | `/api/admin/commercial/negotiations/documents` | Téléchargement signé et upload privé |
| GET | `/api/admin/commercial/negotiations/realtime` | Flux SSE des changements |

L'ancienne route agrégée `/api/admin/commercial` reste disponible en lecture. Ses mutations répondent `410` et indiquent le contrat métier dédié à utiliser.

## Base de données et sécurité

La migration ajoute uniquement les éléments manquants :

- métadonnées d'activité et de documents ;
- contraintes de taille, statut, confidentialité, version et prochaine action ;
- sept index de lecture métier ;
- RPC `move_commercial_pipeline`, `create_commercial_case`, `transform_commercial_estimation`, `create_commercial_visit`, `update_commercial_visit`, `submit_commercial_visit_report`, `create_commercial_offer` ;
- buckets privés `estimation-reports` et `offer-documents` ;
- replica identity et publication Realtime des tables commerciales.

Les vues `v_commercial_pipeline_stats`, `v_commercial_estimation_stats`, `v_commercial_visit_week_stats`, `v_negotiations_kpi` et `v_negotiation_alerts`, ainsi que les triggers de synchronisation des négociations, sont réutilisés depuis les migrations antérieures.

Toutes les nouvelles RPC sont `SECURITY DEFINER`, fixent `search_path=public`, refusent `EXECUTE` à `anon` et `authenticated`, et l'accordent uniquement à `service_role`. Les API exigent en plus une session et la permission administrateur adaptée. Le rollback se trouve dans `supabase/rollbacks/202608140001_commercial_remaining.rollback.sql`.

## Relance client

La relance utilise un connecteur webhook prêt pour un fournisseur transactionnel :

- `CRM_TRANSACTIONAL_COMMUNICATION_WEBHOOK_URL` ;
- `CRM_TRANSACTIONAL_COMMUNICATION_TOKEN` facultatif.

Sans fournisseur configuré, l'API répond `COMMUNICATION_PROVIDER_NOT_CONFIGURED`, n'écrit aucune fausse communication et ne transforme pas l'action en note interne.

## Vérification sans pollution

La commande suivante charge les quatre modèles serveur depuis la base liée, ne produit que des compteurs et n'effectue aucune écriture :

```powershell
npm.cmd run verify:crm-commercial-data
```

Commandes de recette :

```powershell
npm.cmd run test:crm-commercial
npm.cmd run test:crm-e2e # environnement Supabase isolé uniquement
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npx.cmd supabase migration list --linked
npx.cmd supabase db lint --linked --level warning
git diff --check
```

Production : [https://immo-dreams83.vercel.app/commercial/pipeline](https://immo-dreams83.vercel.app/commercial/pipeline)

## Recette E2E

Les mutations et pages authentifiées sont vérifiées sur un projet Supabase temporaire, jamais sur la production. Le protocole reproductible, les garde-fous et les variables attendues sont décrits dans `COMMERCIAL_E2E.md`.

Une relance client ne peut être réellement envoyée qu'après configuration du fournisseur externe. En son absence, l'API retourne une indisponibilité explicite et ne crée aucun faux historique d'envoi.
