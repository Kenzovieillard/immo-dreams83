# IMMO-DREAMS83 - CRM V3 Implementation

## Statut Phase 0

Phase 0 documentee sur la branche `feature/v3-secure-crm-foundation`.

Objectif : stabiliser la feuille de route V3 avant de poursuivre les changements fonctionnels. Cette phase ne doit pas reconstruire le site et ne doit pas casser le socle V2.6 deja livre.

## Architecture Actuelle

### Stack

- Next.js 16 App Router dans `src/app`.
- React 19 et TypeScript.
- Tailwind CSS, shadcn/ui et composants CRM Bento.
- Supabase pour contacts, estimations, biens, activites, profils admin, audit et stockage photos.
- Vercel pour l'hebergement.

### Pages Publiques

- `/`
- `/agence`
- `/a-vendre`
- `/biens`
- `/biens/[slug]`
- `/estimation`
- `/contact`
- `/mentions-legales`
- `/legal/privacy-policy`
- `/legal/cookies`
- `/robots.txt`
- `/sitemap.xml`

Les pages publiques ne doivent jamais afficher l'adresse exacte d'un bien. Les fiches utilisent ville et code postal pour les cartes indicatives.

### Administration

- `/admin` : page serveur protegee par `getAdminSession()`.
- `/admin/login` : page de connexion Supabase Auth.
- `src/proxy.ts` : redirection rapide vers `/admin/login` si le cookie d'acces admin est absent.
- `src/components/admin/admin-dashboard.tsx` : grand composant client CRM actuel.
- `src/components/admin/admin-login-form.tsx` : formulaire de connexion.
- `src/components/admin/bento/*` : composants Bento reutilisables du CRM.

Important : `src/proxy.ts` ne doit pas etre considere comme la seule securite. La page `/admin` et les routes `/api/admin/*` revalident la session cote serveur.

### Routes API

Routes publiques :

- `POST /api/contact`
- `POST /api/estimation`

Routes admin :

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/leads`
- `POST /api/admin/leads`
- `PATCH /api/admin/leads`
- `GET /api/admin/properties`
- `POST /api/admin/properties`
- `PATCH /api/admin/properties`
- `POST /api/admin/property-photos`
- `DELETE /api/admin/property-photos`

Les routes `/api/admin/*` utilisent `requireAdminSession()` sauf login. Logout lit la session quand elle existe, puis supprime les cookies.

## Tables Supabase Actuelles Et Prevues

Tables V2/V2.6 :

- `contacts`
- `estimations`
- `properties`
- `activities`

Tables V3 foundation ajoutees ou preparees :

- `profiles`
- `audit_logs`
- `property_versions`
- `property_history`
- `property_slug_history`
- `property_photos`
- `property_photo_trash`
- `leads`
- `lead_status_history`
- `tasks`
- `communications`
- `appointments`
- `mandates`
- `buyer_searches`
- `match_suggestions`
- `email_events`
- `analytics_snapshots`
- `portal_exports`
- `portal_export_logs`

Storage :

- `property-photos` : bucket public pour les photos de biens.

Migration versionnee actuelle :

- `supabase/migrations/202607150001_v3_secure_crm_foundation.sql`
- `supabase/migrations/202607150002_property_source_of_truth.sql`

Le fichier `supabase/schema.sql` reste le schema complet de reference, mais les futures evolutions doivent etre ajoutees dans `supabase/migrations`.

## Variables D'Environnement

Variables publiques :

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Variables serveur uniquement :

- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_BOOTSTRAP_EMAILS`
- `CONTACT_RECEIVER_EMAIL`
- `EMAIL_FROM`
- `EMAIL_API_KEY`

Regle : aucune variable contenant un secret ne doit utiliser le prefixe `NEXT_PUBLIC_`.

## Etat Authentification Et Permissions

### Deja En Place

- Page `/admin/login`.
- Cookies HTTP-only `immo_admin_access_token` et `immo_admin_refresh_token`.
- Verification de session dans `getAdminSession()`.
- Profils admin dans `profiles`.
- Bootstrap admin via `ADMIN_BOOTSTRAP_EMAILS`.
- Roles prepares :
  - `ADMIN`
  - `DIRECTOR`
  - `AGENT`
  - `ASSISTANT`
  - `MARKETING`
  - `READ_ONLY`
- Permissions serveur actuelles :
  - `crm.read`
  - `lead.write`
  - `property.write`
  - `photo.write`
  - `audit.read`
  - `users.manage`

### Points Fragiles A Corriger En Phase 1

- Le refresh token est stocke mais le renouvellement automatique de session n'est pas encore implemente.
- Le projet utilise `@supabase/supabase-js` avec cookies manuels, pas encore le flux SSR Supabase complet.
- Les droits sont verifies par permission globale, mais pas encore par ressource assignee.
- Le role `MARKETING` possede encore `property.write`, a affiner avant production stricte.
- `service_role` reste utilise pour les ecritures admin apres verification de session. C'est acceptable temporairement, mais doit etre encadre et journalise.
- Pas encore d'ecran de gestion des utilisateurs et roles.
- Pas encore de tests automatises 401/403.

## Utilisation De Supabase

### Clients

- `src/lib/supabase.ts`
  - `getSupabaseClient()` : client anon lazy.
  - `getSupabaseAdminClient()` : client service role lazy, serveur uniquement.

Ce pattern est compatible build car les clients ne sont pas initialises au module scope sans verifier les variables.

### Usages Service Role

Usages identifies :

- `src/lib/admin-auth.ts` : lecture/creation profil admin, audit logs.
- `src/app/api/admin/leads/route.ts` : lecture et modification contacts, estimations, activites.
- `src/app/api/admin/properties/route.ts` : lecture, creation, modification, historique biens.
- `src/app/api/admin/property-photos/route.ts` : upload, bucket, corbeille photo.
- `src/app/api/contact/route.ts` et `src/app/api/estimation/route.ts` : insertion publique avec fallback admin si disponible.

Risque : toute route utilisant `service_role` doit valider la session, le role, les entrees et journaliser l'action sensible.

## Catalogue Immobilier

### Etat Actuel

Le catalogue public est branche sur Supabase comme source unique :

- `src/lib/public-properties.ts` lit la vue `public_properties`.
- `/admin` charge les biens via `/api/admin/properties`.
- `src/data/properties.ts` sert uniquement de seed d'import.
- `src/app/sitemap.ts` lit les biens publics Supabase.
- les anciennes URLs passent par `property_slug_history`.

### Risque

Le site public depend maintenant de la migration Phase 2 et de la vue `public_properties`. La migration Phase 2 a ete appliquee sur le projet Supabase cible le 16/07/2026 et l'import reel des biens a ete execute.

Etat valide apres import :

- 13 biens dans `properties`;
- 12 biens issus du seed historique;
- 12 biens visibles dans `public_properties`;
- 48 photos actives dans `property_photos`;
- 0 doublon reference;
- 0 doublon slug;
- lecture directe anonyme de `properties` bloquee par RLS.

Si un autre environnement Supabase n'a pas encore cette migration, le catalogue public y restera vide volontairement plutot que d'afficher de fausses donnees.

### Correction V3 Phase 2

Phase 2 implementee :

- import idempotent des biens statiques ;
- conservation des slugs ;
- publication controlee ;
- archivage ;
- suppression du fallback statique ;
- photos normalisees dans `property_photos` ;
- historique des actions dans `property_history`.

## Operations Sensibles Identifiees

Creation :

- contact public ;
- estimation publique ;
- contact manuel CRM ;
- bien CRM ;
- photo CRM.

Modification :

- statut prospect ;
- notes internes ;
- archivage prospect ;
- statut bien ;
- mise a la une ;
- champs bien ;
- galerie photo.

Suppression logique :

- retrait photo via `property_photo_trash`.

Suppression definitive :

- pas encore exposee dans l'interface CRM.

Toutes les operations sensibles doivent etre journalisees dans `audit_logs` ou `activities` selon leur nature.

## Risques Identifies

| Severite | Risque | Impact | Phase cible |
|---|---|---|---|
| Critique | Session admin sans refresh robuste | Deconnexion ou session expiree mal geree | Phase 1 |
| Critique | `service_role` encore central pour admin | Bypass RLS si une route est mal protegee | Phase 1 |
| Elevee | Droits par role trop globaux | Un role peut faire plus que necessaire | Phase 1 |
| Elevee | Migration Phase 2 absente sur un autre environnement Supabase | Catalogue public vide | Phase 2 |
| Elevee | `admin-dashboard.tsx` concentre trop de logique | Maintenance difficile et risque regression | Phase 4 |
| Moyenne | Pas de tests API 401/403 automatises | Regression securite difficile a detecter | Phase 1 |
| Moyenne | Photos en corbeille sans ecran de restauration | Recuperation manuelle uniquement | Phase 2 |
| Moyenne | Contacts et estimations restent separes | Doublons CRM | Phase 3 |
| Moyenne | Emails placeholder | Delai de traitement moins fiable | Phase 7 |
| Moyenne | GA4 non connecte | Stats marketing incompletes | Phase 8 |

## Dependances Entre Phases

1. Phase 0 : audit, documentation, branche, validations.
2. Phase 1 : auth, RBAC, RLS, audit logs, suppression du verrou local.
3. Phase 2 : Supabase source unique des biens.
4. Phase 3 : modele contacts/leads normalise.
5. Phase 4 : pipeline, taches, relances, communications et refactor admin.
6. Phase 5 : mandats, visites, offres, transactions.
7. Phase 6 : recherches acquereurs et matching.
8. Phase 7 : emails, notifications, automatisations.
9. Phase 8 : statistiques metier et GA4.
10. Phase 9 : preparation multidiffusion.

Regle : ne pas demarrer une phase dependante si les validations de la phase precedente ne sont pas vertes.

## Strategie De Retour Arriere

Avant toute migration production :

1. Exporter les tables Supabase existantes : `contacts`, `estimations`, `properties`, `activities`.
2. Exporter les nouvelles tables V3 si deja appliquees.
3. Exporter la liste des objets du bucket `property-photos`.
4. Sauvegarder `.env.example` et documenter les variables Vercel.
5. Deployer sur une branche de preview avant production.

Retour arriere applicatif :

- revert du commit de phase ;
- redeploiement Vercel du dernier commit stable ;
- conservation des migrations non destructives ;
- desactivation temporaire d'une fonctionnalite par etat "non configure" si la cle externe manque.

Retour arriere donnees :

- ne pas supprimer de colonnes en V3 ;
- privilegier `archived_at`, `deleted_at`, `purged_at` ;
- garder les anciennes tables lisibles pendant la transition ;
- documenter toute migration de donnees avec rapport d'import.

## Plan De Migration

### Phase 1 - Securite Admin

- Implementer le renouvellement de session Supabase.
- Verifier tous les retours 401/403.
- Affiner la matrice permissions.
- Completer RLS.
- Journaliser login, logout, echec login et actions sensibles.
- Supprimer toute trace de `NEXT_PUBLIC_ADMIN_LOCAL_CODE`.

### Phase 2 - Biens Supabase Source Unique

- Ajouter statuts publication/commercialisation.
- Importer les biens statiques avec script idempotent.
- Retirer progressivement le fallback statique.
- Ajouter restauration photo et purge reservee aux roles autorises.

### Phase 3 - Contacts Et Leads

- Creer contact unique par personne.
- Creer lead par projet.
- Ajouter sources, UTM, dedoublonnage et historique de statut.
- Avant implementation, executer le dry-run lecture seule :

```bash
npm run crm:legacy-dry-run
```

Ce rapport lit `contacts` et `estimations`, normalise email/telephone, classe les rapprochements en `MATCH CERTAIN`, `MATCH PROBABLE`, `AMBIGU` et `AUCUN MATCH`, puis simule les futurs payloads `contacts`, `leads`, `lead_status_history` et `communications` sans ecrire dans Supabase.

Pour conserver un rapport JSON local non suivi par Git :

```bash
npm run crm:legacy-dry-run -- --write-report
```

### Phase 4 - Pipeline Et Refactor

- Ajouter taches, relances, communications.
- Decouper `admin-dashboard.tsx` en modules : dashboard, leads, contacts, properties, tasks, activities, statistics.

### Phases 5 A 9

- Mandats, visites, offres, transactions.
- Matching acquereurs.
- Emails et automatisations.
- GA4 et statistiques.
- Preparation exports portails sans connecteurs fictifs.

## Validations Phase 0

- Branche actuelle : `feature/v3-secure-crm-foundation`.
- Audit architecture : fait.
- Routes admin et publiques : inventoriees.
- Usages `SUPABASE_SERVICE_ROLE_KEY` : inventories.
- Usages `NEXT_PUBLIC_ADMIN_LOCAL_CODE` : plus d'usage code actif identifie, seulement mention documentaire historique.
- Dependances `src/data/properties.ts` : identifiees.
- Routes admin sensibles : identifiees.
- Strategie de migration : documentee.
- Strategie de retour arriere : documentee.

Commandes a executer avant cloture :

```bash
npm run lint
npm run build
```

## Actions Manuelles Supabase

- Verifier que `supabase/schema.sql` ou `supabase/migrations/202607150001_v3_secure_crm_foundation.sql` est applique.
- Creer au moins un utilisateur Supabase Auth.
- Ajouter son email dans `ADMIN_BOOTSTRAP_EMAILS`.
- Se connecter a `/admin/login` pour creer le premier profil `ADMIN`.
- Verifier les policies RLS dans le dashboard Supabase.

## Limites De Phase 0

- Cette phase documente et stabilise le plan ; elle ne resout pas toutes les faiblesses listees.
- La recette visuelle mobile authentifiee necessite un compte Supabase Auth disponible.
- Les anciennes donnees statiques restent presentes jusqu'a la Phase 2.
- Le CRM reste encore concentre dans un grand composant client, a refactorer progressivement.
