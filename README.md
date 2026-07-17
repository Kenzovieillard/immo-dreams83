# IMMO-DREAMS83

Plateforme immobiliere responsive de l'agence IMMO-DREAMS83, situee a Sollies-Pont et specialisee dans la vente, l'achat et l'estimation de maisons, appartements et terrains dans le Var.

## Version actuelle

V3 phase 3 - CRM securise, Supabase source unique des biens, revue des anciennes demandes et pipeline commercial quotidien.

Cette version conserve le socle V2.6, ajoute la securite admin V3 et branche le catalogue immobilier public sur Supabase comme source unique via la vue `public_properties`.

La Phase 3 demarre cote applicatif avec un ecran `Anciennes demandes` dans `/admin`. Il permet de verifier les rapprochements entre anciennes demandes `contacts` et `estimations`, de journaliser une decision manuelle, puis de migrer les demandes validees vers `leads`. Elle ajoute maintenant un onglet `Pipeline` pour traiter les prospects normalises, assigner un responsable, creer des rappels, suivre les retards, consulter une vue hebdomadaire et preparer des relances email sans envoi automatique.

## Nouveautes V3 foundation

- page `/admin/login` avec connexion Supabase Auth ;
- protection serveur de `/admin` ;
- protection des routes `/api/admin/*` par session et permissions ;
- suppression de l'ancien code public `NEXT_PUBLIC_ADMIN_LOCAL_CODE` ;
- roles admin prepares : `ADMIN`, `DIRECTOR`, `AGENT`, `ASSISTANT`, `MARKETING`, `READ_ONLY` ;
- table `profiles` pour relier les utilisateurs Supabase Auth au CRM ;
- table `audit_logs` pour tracer les actions sensibles ;
- table `property_versions` pour historiser les modifications de biens ;
- table `property_photo_trash` pour eviter la suppression definitive immediate des photos ;
- migration versionnee dans `supabase/migrations` ;
- lecture publique des biens avec la cle anon et les policies RLS.
- source unique Supabase pour les biens publics ;
- vue publique `public_properties` sans colonnes internes ;
- statuts separes commercial/publication ;
- historique `property_history` ;
- photos normalisees dans `property_photos` avec corbeille et restauration technique ;
- script d'import idempotent des biens statiques historiques.
- onglet CRM `Anciennes demandes` pour controler les rapprochements avant migration contacts/leads ;
- route admin `/api/admin/legacy-review` protegee par session et permission CRM ;
- journalisation des decisions de revue dans `lead_merge_logs` ;
- migration controlee des anciennes demandes `contacts` et `estimations` vers `leads`, avec historique de statut et communication initiale.
- onglet CRM `Pipeline` pour suivre les leads normalises au quotidien ;
- route admin `/api/admin/pipeline` protegee par session pour statuts, priorites, assignations et rappels ;
- migration `202607160003_commercial_pipeline_foundation.sql` appliquee pour renforcer les taches, rappels et policies de lecture admin ;
- vue quotidienne du pipeline : plan de journee, rappels en retard, assignation rapide, suivi par agent ;
- vue hebdomadaire du pipeline, rappels recurrents et intention de notification email preparee ;
- migration `202607160004_crm_reminder_automation.sql` pour persister recurrence et preparation email sur les taches ;
- journal d'activite filtre par defaut pour masquer les traces de recette, avec option `Tout afficher`.

## Fonctionnalites V2.6

- grille adaptative des biens a la une selon le nombre de biens mis en avant ;
- cartes de biens avec hauteur plus coherente et CTA aligne ;
- carte Google Maps sur la page Contact avec l'adresse officielle de l'agence ;
- carte Google Maps indicative sur les fiches biens avec ville et code postal uniquement ;
- layout CRM plus large avec navigation par onglets plus lisible sur mobile et desktop ;
- tableau de bord CRM en style bento ;
- statistiques CRM, portefeuille, villes, formulaires et activites plus completes ;
- journal d'activite searchable et filtrable ;
- emplacement prepare pour de futures statistiques GA4, sans fausses donnees.

## Socle V2.5 deja en place

- site vitrine premium avec pages Accueil, Agence, A vendre, Estimation, Biens et Contact ;
- catalogue public de biens lu depuis Supabase ;
- fiches dynamiques avec galerie, diagnostics, partage, formulaire et biens similaires ;
- formulaires Contact et Estimation relies aux routes API et a Supabase ;
- mini-CRM sur `/admin` avec contacts, estimations, biens, activites et statistiques ;
- creation manuelle de contacts depuis le CRM ;
- creation et edition de biens avec reference automatique ;
- upload photo depuis fichiers locaux vers Supabase Storage ;
- gestion de galerie photo : photo principale, reordonnancement et suppression Storage des photos retirees ;
- pilotage de la disponibilite des biens : disponible, sous offre, vendu ;
- mise a la une des biens depuis le CRM ;
- aide DPE/GES par saisie numerique, avec formatage automatique ;
- mode terrain avec informations specifiques : bornage, constructibilite, viabilisation, acces, servitudes, risques et etude de sol ;
- correctifs responsive mobile, dont la prevention du zoom Safari sur les champs ;
- mentions legales, confidentialite, cookies, sitemap, robots et donnees structurees.

## Stack

- Next.js App Router et TypeScript ;
- Tailwind CSS et shadcn/ui ;
- Supabase pour les prospects, estimations, biens, activites et photos ;
- Vercel pour l'hebergement.

## Lancer le projet

```bash
npm install
npm run dev
```

Ouvrir ensuite `http://127.0.0.1:3000`.

## Configuration Supabase

1. Creer un projet Supabase.
2. Copier `.env.example` vers `.env.local`.
3. Renseigner les variables sans commiter `.env.local`.
4. Appliquer les migrations versionnees de `supabase/migrations` sur l'environnement de test.
5. Ne pas rejouer aveuglement `supabase/schema.sql` sur une base existante : ce fichier sert de reference globale.
6. Si Supabase CLI n'est pas disponible, appliquer uniquement les fichiers de migration necessaires dans SQL Editor.
7. Verifier que `public_properties`, `property_photos`, `property_history`, les policies RLS et le bucket `property-photos` existent.
8. Executer le dry-run d'import des biens, puis l'import reel si le rapport est correct.

Variables attendues :

```text
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_BOOTSTRAP_EMAILS=
CONTACT_RECEIVER_EMAIL=
EMAIL_FROM=
EMAIL_API_KEY=
```

La cle `SUPABASE_SERVICE_ROLE_KEY` reste strictement cote serveur. Elle permet aux routes API admin de lire et modifier les prospects, biens et photos apres verification de session et de role.

`ADMIN_BOOTSTRAP_EMAILS` sert a creer automatiquement le premier profil `ADMIN` lorsqu'un utilisateur Supabase Auth autorise se connecte pour la premiere fois. Exemple :

```text
ADMIN_BOOTSTRAP_EMAILS=antoine.faridoni@immo-dreams83.fr
```

## Comment utiliser le CRM

1. Appliquer les migrations versionnees V3 necessaires dans Supabase.
2. Creer un utilisateur dans Supabase Auth.
3. Ajouter son email dans `ADMIN_BOOTSTRAP_EMAILS`.
4. Ouvrir `/admin/login`.
5. Se connecter avec l'email et le mot de passe Supabase Auth.
6. Consulter les contacts, estimations, biens, activites et statistiques.
7. Ouvrir `Pipeline` pour traiter les leads normalises, assigner un agent et creer un rappel.
8. Modifier un statut, ajouter une note ou archiver un prospect.
9. Creer un contact manuel si une demande arrive par telephone ou en agence.
10. Creer ou modifier un bien avec prix FAI, statut, photos, DPE/GES, options terrain et mise en avant.
11. Verifier ensuite le rendu public sur Accueil, Biens et la fiche detail.

Sans Supabase Auth configure, le CRM n'est pas accessible. Le site public reste disponible.

## Importer les biens officiels

Simulation :

```bash
npm run properties:import:dry-run
```

Application :

```bash
npm run properties:import
```

Le script conserve les references et les slugs existants, puis ecrit un rapport JSON dans `reports/`.

## Auditer les exports Lesty

Les exports du site mere Lesty doivent etre verifies avant tout import reel vers Supabase.

Pages Lesty utiles pour les futures verifications :

```text
https://immodreams.lesty.immo/modspec/statsActivite.php
https://immodreams.lesty.immo/annu/annu.php?modRef=35
https://immodreams.lesty.immo/modspec/passerelles.php
https://immodreams.lesty.immo/modspec/passerellesAdmin.php
```

Placer ou conserver les CSV dans `Downloads`, puis lancer :

```bash
npm run lesty:audit -- --write-report
```

Le script cherche automatiquement les derniers fichiers `biens*.csv` et `ged_contact*.csv` dans le dossier `Downloads`.

Il est aussi possible de cibler des fichiers precis :

```bash
npm run lesty:audit -- --biens "C:\Users\Kenzo\Downloads\biens (2026-07-16 220751).csv" --contacts "C:\Users\Kenzo\Downloads\ged_contact (2026-07-16 220737).csv" --write-report
```

Cet audit ne modifie aucune donnee. Il verifie :

- volume et colonnes disponibles ;
- doublons de references et de mandats ;
- repartition des statuts Lesty ;
- couverture des champs publics : titre, texte, prix, surface, DPE, GES ;
- presence des contacts et doublons email/telephone sans afficher les donnees privees ;
- points bloquants avant import.

Les photos ne sont pas incluses dans le CSV principal. Elles devront etre recuperees separement depuis la galerie Lesty ou via la convention publique `/photo/immodreams/biens/{ref}-{index}.jpg`, toujours en dry-run avant import.

### Preparer un dry-run de biens Lesty vers Supabase

Le dry-run suivant transforme le CSV Lesty en payloads compatibles avec la table `properties` et les futures lignes `property_photos`, sans ecrire en base :

```bash
npm run lesty:properties:dry-run -- --write-report
```

Avec detection legere des photos :

```bash
npm run lesty:properties:dry-run -- --probe-photos --max-photo-index 20 --write-report
```

Pour sonder davantage de photos avant import reel :

```bash
npm.cmd run lesty:properties:dry-run -- --probe-photos --max-photo-index 40 --write-report
```

Avec fichier precis :

```bash
npm run lesty:properties:dry-run -- --biens "C:\Users\Kenzo\Downloads\biens (2026-07-16 220751).csv" --probe-photos --write-report
```

Regle de reference retenue pour le dry-run :

- `properties.reference` = reference interne Lesty `ref`, unique dans l'export ;
- `properties.mandate_number` = numero de mandat Lesty `nummandat`, conserve pour le suivi commercial ;
- les statuts Lesty sont normalises vers `commercial_status` et `publication_status` ;
- les types Lesty sont normalises vers `apartment`, `house`, `land`, `commercial`, `parking` ou `other` ;
- les donnees proprietaires, adresses precises et commentaires internes ne sont jamais exposees dans le payload public.

Avant l'import reel Lesty, appliquer la migration non destructive :

```text
supabase/migrations/202607160005_lesty_property_types.sql
```

Elle autorise les nouveaux types `commercial`, `parking` et `other` dans `properties.type`.

Import reel protege :

```bash
npm.cmd run lesty:properties:import -- --probe-photos --max-photo-index 40 --copy-photos --write-report
```

Cette commande :

- exige un dry-run sans bloqueur avant ecriture ;
- cree ou met a jour les biens par reference Lesty ;
- archive les anciens doublons de transition sans suppression definitive ;
- copie les photos detectees dans Supabase Storage quand le fichier est accepte ;
- conserve l'URL externe d'une photo si Supabase Storage la refuse, par exemple si elle depasse la limite de taille ;
- ecrit un rapport JSON local dans `reports/`.

Dernier import Lesty valide le 17/07/2026 :

```text
reports/lesty-properties-import-2026-07-17T01-18-06-646Z.json
```

Resultat constate :

- 88 lignes CSV Lesty analysees ;
- 88 payloads valides ;
- 7 creations ;
- 81 mises a jour ;
- 0 bien bloque ;
- 0 bien en revue manuelle ;
- 782 photos detectees pendant l'import ;
- 9 anciens doublons archives sans suppression ;
- 36 biens visibles dans `public_properties` apres import ;
- 52 biens conserves dans le CRM en non publie ;
- 2 photos conservees en URL externe car trop volumineuses pour Supabase Storage.

### Importer les contacts Lesty

L'export `ged_contact*.csv` du site mere peut etre importe dans la table CRM `contacts`.

Dry-run sans ecriture :

```bash
npm.cmd run lesty:contacts:dry-run -- --write-report
```

Import reel :

```bash
npm.cmd run lesty:contacts:import -- --write-report
```

Avec fichier precis :

```bash
npm.cmd run lesty:contacts:import -- --contacts "C:\Users\Kenzo\Downloads\ged_contact (2026-07-16 220737).csv" --write-report
```

Regles retenues :

- chaque contact est identifie par le marqueur technique `LESTY_GED_CONTACT:{ref}` dans ses notes CRM ;
- les relances ulterieures mettent a jour le contact existant au lieu de le dupliquer ;
- les emails reels sont normalises quand ils existent ;
- les contacts sans email recoivent une adresse technique locale `lesty-{ref}@legacy.immo-dreams83.local`, a ne pas utiliser pour un envoi client ;
- les telephones sont normalises en format francais quand c'est possible ;
- les informations Lesty utiles restent visibles uniquement dans le CRM, pas dans les pages publiques.

## Partie 3 CRM commercial

Pour auditer `contacts` et `estimations` avant toute action, executer le rapport lecture seule :

```bash
npm run crm:legacy-dry-run
```

Ce script ne modifie pas Supabase. Il produit les rapprochements `MATCH CERTAIN`, `MATCH PROBABLE`, `AMBIGU` et `AUCUN MATCH`, puis simule les futurs payloads `contacts`, `leads`, `lead_status_history` et `communications`.

Pour conserver un rapport JSON local ignore par Git :

```bash
npm run crm:legacy-dry-run -- --write-report
```

Une revue visuelle est aussi disponible dans le CRM :

1. ouvrir `/admin` avec un compte Supabase Auth autorise ;
2. aller dans l'onglet `Anciennes demandes` ;
3. filtrer les cas par categorie de rapprochement ou statut de revue ;
4. ajouter une note de revue ;
5. enregistrer une decision : `Pret pour migration future`, `A revoir manuellement` ou `Ne pas fusionner`.

Important : cet ecran ne migre rien tout seul. Il journalise uniquement la decision dans `lead_merge_logs` et trace l'action dans l'audit admin.

Une fois les cas ambigus arbitres, verifier la migration `contacts/leads` avec :

```bash
npm run crm:legacy-migrate:dry-run
```

Ce dry-run connecte Supabase :

- exclut les cas marques `IGNORED` ;
- bloque les cas `AMBIGU` non arbitres ;
- detecte les leads legacy deja crees via `source_table` + `source_id` ;
- produit un rapport JSON local dans `reports/` ;
- ne modifie aucune donnee.

La migration de garde-fou appliquee sur Supabase le 16/07/2026 est :

```text
supabase/migrations/202607160002_legacy_lead_import_guardrails.sql
```

Elle ajoute un index unique partiel pour renforcer la protection contre les doublons si l'import est relance. Verification SQL OK : `leads_source_table_source_id_unique` et `leads_source_table_source_id_idx` existent dans `pg_indexes`.

Execution reelle uniquement apres validation du rapport dry-run :

```bash
npm run crm:legacy-migrate
```

### Pipeline quotidien

Le CRM dispose maintenant d'un onglet :

```text
/admin > Pipeline
```

Cet onglet lit le modele normalise `leads` et `tasks`.

Il permet de :

- voir les leads actifs ;
- identifier les rappels du jour et les rappels en retard ;
- traiter un plan de journee priorise ;
- assigner rapidement les leads sans responsable ;
- suivre la charge commerciale par agent ;
- consulter une vue hebdomadaire des rappels ouverts ;
- filtrer par statut, agent ou recherche libre ;
- modifier statut, priorite, assignation et notes ;
- creer un rappel simple, recurrent hebdomadaire ou recurrent mensuel ;
- preparer une relance email sans l'envoyer automatiquement ;
- terminer ou rouvrir un rappel.

Route API protegee :

```text
GET /api/admin/pipeline
POST /api/admin/pipeline
PATCH /api/admin/pipeline
```

Migrations appliquees avant recette complete :

```text
supabase/migrations/202607160003_commercial_pipeline_foundation.sql
supabase/migrations/202607160004_crm_reminder_automation.sql
```

Ces migrations sont non destructives. Elles ajoutent des colonnes de suivi sur `tasks`, des index de lecture, des policies de lecture admin pour `leads`, `tasks`, `communications`, `appointments` et `lead_status_history`, puis les champs de recurrence et d'intention de notification email.

## Statut Phase 3

Statut actuel : **Phase 3 CRM commercial en production, socle quotidien exploitable**.

La Phase 2 Supabase source unique des biens a ete appliquee sur le projet Supabase cible le 16/07/2026 via SQL Editor, car la Supabase CLI n'etait pas authentifiee localement.

Resultat Phase 2 valide :

- La branche `feature/v3-supabase-property-source` est poussee et la PR draft Phase 2 est ouverte : https://github.com/Kenzovieillard/immo-dreams83/pull/3.
- GitHub CLI `gh` est installe mais pas encore authentifie localement ; le push a toutefois fonctionne via Git Credential Manager.
- `.env.local` est configure localement et ignore par Git.
- Migration Phase 1 appliquee : `supabase/migrations/202607150001_v3_secure_crm_foundation.sql`.
- Migration Phase 2 appliquee : `supabase/migrations/202607150002_property_source_of_truth.sql`.
- Dry-run biens connecte OK : 12 biens analyses, 7 mises a jour, 5 creations.
- Import reel biens OK : 12 biens synchronises depuis `src/data/properties.ts`.
- Donnees post-import : 13 biens au total, 12 biens importes, 0 doublon reference, 0 doublon slug.
- Photos post-import : 48 photos actives, 12 photos principales.
- Vue publique `public_properties` : 12 biens visibles, 7 biens a la une.
- Lecture anonyme directe de `properties` : bloquee par RLS.
- Rapport legacy CRM relance : 10 demandes analysees, 9 `MATCH CERTAIN`, 1 `AMBIGU`, aucune ecriture.
- `npm run lint` OK.
- `npm run build` OK.
- Sur la branche `feature/v3-commercial-crm-foundation`, la migration Phase 3 non destructive a ete appliquee : `lead_sources`, `lead_import_runs`, `lead_merge_logs` et `crm_legacy_lead_candidates` sont disponibles.
- L'ecran applicatif de revue des anciennes demandes est disponible dans `/admin` via l'onglet `Anciennes demandes`.
- La route `/api/admin/legacy-review` permet de charger la revue et de journaliser une decision sans migration.
- Le script `npm run crm:legacy-migrate:dry-run` prepare et controle la migration contacts/leads en excluant les cas `IGNORED`.
- Import reel Phase 3 execute le 16/07/2026 : 9 leads crees, 9 historiques de statut crees, 9 communications initiales creees, 0 contact supplementaire cree, 1 cas legacy ignore.
- Dry-run post-import OK : 9 leads legacy deja presents, 0 lead a creer, 0 bloqueur.
- Migration de garde-fou Phase 3 appliquee et verifiee : index unique `leads_source_table_source_id_unique` et index de lecture `leads_source_table_source_id_idx`.
- Dry-run post-garde-fou OK : 9 leads legacy deja presents, 0 lead a creer, 0 bloqueur.
- Pipeline commercial applicatif ajoute : statuts, priorites, assignation, rappels et vue quotidienne.
- Migration pipeline appliquee et validee : `supabase/migrations/202607160003_commercial_pipeline_foundation.sql`.
- Merge de `feature/v3-commercial-crm-foundation` dans `main` effectue.
- Vercel production redeploye et valide : `/admin` OK, pipeline OK, session admin OK.
- Recette production pipeline OK : acces anonyme refuse, assignation temporaire, changement de statut, rappel cree, rappel termine, lead restaure.
- Increment quotidien ajoute : plan de journee, rappels en retard, assignation rapide, suivi par agent, filtre des activites de recette.
- Recette mobile iPhone du pipeline effectuee en largeur 390 px : aucun scroll horizontal global detecte, cartes Pipeline visibles, trace de recette masquee par defaut.
- Increment rappels avance ajoute : vue hebdomadaire, rappels recurrents, preparation des notifications email sans envoi automatique.

Actions restantes recommandees :

1. Appliquer `supabase/migrations/202607160004_crm_reminder_automation.sql` sur Supabase production si ce n'est pas encore fait.
2. Recetter un rappel recurrent et une relance email preparee dans `/admin > Pipeline`.
3. Brancher un vrai fournisseur email avant tout envoi automatique.
4. Authentifier GitHub CLI si le flux PR doit etre gere depuis le terminal :

```bash
gh auth status
```

Si le terminal courant ne retrouve pas encore `gh` apres installation Windows, ouvrir un nouveau terminal ou utiliser :

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' auth login
& 'C:\Program Files\GitHub CLI\gh.exe' auth status
```

6. Connecter Supabase CLI plus tard pour remplacer l'application manuelle SQL Editor :

```bash
npx supabase login
npx supabase projects list
```

Commandes de verification utiles :

```bash
npm run properties:import:dry-run
npm run crm:legacy-dry-run -- --write-report
npm run lint
npm run build
```

Critere de sortie :

```text
PRET A IMPLEMENTER LA PARTIE 3
```

Le depot est maintenant dans cet etat cote migration/import. La Partie 3 reste sur sa branche dediee et commence par le modele contacts/leads, sans mutation destructive des donnees legacy.

## Routes importantes

- `/`
- `/agence`
- `/a-vendre`
- `/biens`
- `/biens/[slug]`
- `/estimation`
- `/contact`
- `/admin`
- `/mentions-legales`
- `/legal/privacy-policy`
- `/legal/cookies`

## CRM et administration

`/admin` est protege par Supabase Auth. Les appels `/api/admin/*` refusent les requetes sans session CRM active et sans permission suffisante.

## Cartes et localisation

La page Contact utilise une carte Google Maps iframe basee sur l'adresse officielle de l'agence. Les fiches biens utilisent une localisation indicative basee uniquement sur la ville et le code postal, afin de ne pas exposer d'adresse privee.

## Statistiques

Les statistiques CRM sont calculees a partir des donnees locales ou Supabase deja disponibles. GA4 n'est pas encore connecte : les blocs de trafic web sont volontairement affiches comme a connecter pour une future integration Google Analytics Data API.

## Documentation

- Setup technique : `docs/V2_5_SETUP.md`
- Recette mobile et CRM : `docs/V2_5_RECETTE.md`
- Recette V2.6 : `docs/V2_6_RECETTE.md`
- Inventaire des annonces importees : `docs/PROPERTY_IMPORTS.md`
- Design system CRM Bento : `docs/CRM_BENTO_DESIGN_SYSTEM.md`
- Implementation CRM V3 : `docs/CRM_V3_IMPLEMENTATION.md`
- Demarrage CRM commercial V3 : `docs/V3_PHASE_3_CRM_COMMERCIAL.md`
- Objectifs V3 : `docs/V3.md`

## Verifications

```bash
npm run lint
npm run build
```

## Limites actuelles

- aucun fournisseur email reel n'est active ;
- les notifications email CRM sont seulement preparees, aucun email de rappel n'est envoye automatiquement ;
- GA4 n'est pas connecte ;
- Google Maps utilise des embeds iframe sans cle API ;
- `src/data/properties.ts` reste seulement un seed d'import historique, pas une source publique de fallback ;
- la suppression definitive d'un bien complet n'est pas encore disponible dans le CRM ;
- la restauration visuelle des photos en corbeille n'a pas encore d'ecran dedie ;
- la carte presente une localisation indicative ;
- la multidiffusion portails n'est pas encore active ;
- l'aide DPE/GES ne remplace pas le diagnostic officiel fourni par un diagnostiqueur certifie.

## Prochaine amelioration

La suite V3 devra brancher un fournisseur email reel, automatiser les relances recurrentes, puis avancer vers mandats, matching acquereurs, statistiques GA4 et exports portails.
