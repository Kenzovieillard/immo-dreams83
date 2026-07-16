# V3 Phase 3 - CRM commercial

## Statut

Phase 3 demarree cote depot et socle Supabase applique le 16/07/2026.

Pre-requis Phase 2 valides le 16/07/2026 :

1. migration securite appliquee : `supabase/migrations/202607150001_v3_secure_crm_foundation.sql` ;
2. migration biens appliquee : `supabase/migrations/202607150002_property_source_of_truth.sql` ;
3. import reel des 12 biens statiques execute ;
4. vue `public_properties` validee avec 12 biens visibles ;
5. table `property_photos` validee avec 48 photos actives ;
6. lecture anonyme directe de `properties` bloquee ;
7. `npm run lint` OK ;
8. `npm run build` OK.

Socle Phase 3 valide :

- migration appliquee : `supabase/migrations/202607160001_leads_data_model_foundation.sql` ;
- 6 sources de leads disponibles dans `lead_sources` ;
- vue `crm_legacy_lead_candidates` lisible avec les 10 demandes legacy ;
- tables `lead_import_runs` et `lead_merge_logs` lisibles ;
- colonnes de normalisation disponibles sur `contacts` ;
- colonnes Phase 3 disponibles sur `leads` ;
- dry-run legacy relance sans ecriture.
- ecran applicatif `/admin` > `Revue legacy` ajoute pour traiter les rapprochements avant migration reelle.
- route protegee `/api/admin/legacy-review` ajoutee pour charger les cas et journaliser les decisions humaines.
- import reel legacy execute le 16/07/2026 : 9 leads crees, 9 historiques de statut crees, 9 communications initiales creees, 1 cas ignore.
- dry-run post-import valide : 9 leads legacy deja presents, 0 lead a creer, 0 bloqueur.
- migration de garde-fou `202607160002_legacy_lead_import_guardrails.sql` appliquee et verifiee dans Supabase.
- dry-run post-garde-fou valide : 9 leads legacy deja presents, 0 lead a creer, 0 bloqueur.
- onglet applicatif `Pipeline` ajoute dans `/admin` pour suivre les leads normalises.
- route protegee `/api/admin/pipeline` ajoutee pour les statuts, priorites, assignations et rappels.
- migration non destructive appliquee et validee : `supabase/migrations/202607160003_commercial_pipeline_foundation.sql`.
- merge de `feature/v3-commercial-crm-foundation` dans `main` effectue le 16/07/2026.
- redeploiement Vercel production valide : `/admin` repond, pipeline charge, session admin OK.
- recette pipeline production validee : acces non authentifie refuse, assignation temporaire, changement de statut, creation de rappel, cloture du rappel, restauration du lead.
- increment quotidien ajoute : plan de journee, rappels en retard, assignation rapide, suivi commercial par agent et filtre des activites de recette.
- recette mobile iPhone du pipeline effectuee en largeur 390 px : cartes principales visibles, aucun scroll horizontal global detecte, trace de recette masquee par defaut.
- increment rappels avance ajoute : vue hebdomadaire, rappels recurrents et preparation des notifications email sans envoi automatique.
- migration non destructive preparee : `supabase/migrations/202607160004_crm_reminder_automation.sql`.

## Recette Mobile/Admin Authentifiee

Recette effectuee le 16/07/2026 sur la production Vercel apres merge Phase 2 et hotfix login.

Validation mobile CRM en largeur 390 px :

- login admin OK ;
- vue d'ensemble OK ;
- onglet Contacts OK ;
- onglet Estimations OK ;
- onglet Biens OK ;
- onglet Activites OK ;
- onglet Statistiques OK ;
- aucun scroll horizontal global detecte sur les onglets testes.

Actions admin testees avec un compte temporaire de recette, puis nettoyees :

- upload photo OK ;
- creation d'un bien brouillon OK ;
- modification du bien OK ;
- corbeille photo OK ;
- restauration photo OK ;
- archivage du bien OK ;
- restauration du bien en brouillon OK ;
- suppression des donnees temporaires de recette OK.

## Objectif

Transformer les anciennes demandes `contacts` et `estimations` en un modele CRM plus propre :

- une personne unique dans `contacts` ;
- un ou plusieurs projets dans `leads` ;
- une source commerciale explicite ;
- un historique de statut ;
- une trace des fusions et rapprochements.

## Migration ajoutee

Fichier :

```text
supabase/migrations/202607160001_leads_data_model_foundation.sql
```

Cette migration est non destructive.

Elle ajoute :

- `lead_sources` ;
- colonnes de normalisation sur `contacts` ;
- champs commerciaux enrichis sur `leads` ;
- `lead_merge_logs` ;
- `lead_import_runs` ;
- vue `crm_legacy_lead_candidates`.

Elle ne supprime pas les anciennes tables.

## Rapport dry-run

Le rapport de preparation reste :

```bash
npm run crm:legacy-dry-run -- --write-report
```

Etat du dernier dry-run connecte :

- 5 contacts lus ;
- 5 estimations lues ;
- 10 soumissions analysees ;
- 9 `MATCH CERTAIN` ;
- 1 `AMBIGU` ;
- 0 `AUCUN MATCH`.

Le cas ambigu a ete traite manuellement avant migration effective.

Decision Phase 3 :

- ne pas migrer automatiquement le cas `AMBIGU` ;
- le classer en revue manuelle avant toute transformation legacy ;
- conserver les anciennes tables `contacts` et `estimations` lisibles ;
- ne lancer aucune fusion automatique sur simple correspondance telephone.

Raison : le cas ambigu est rapproche uniquement par telephone avec une demande legacy archivee. Cette correspondance est insuffisante pour fusionner ou creer un contact canonical sans validation humaine.

## Preparation De La Migration Reelle Contacts/Leads

Le cas `AMBIGU` bloquant a ete arbitre en revue manuelle avec la decision :

```text
Ne pas fusionner
```

Le contact legacy concerne est marque :

```text
contacts.dedupe_status = IGNORED
```

La migration reelle est geree par un script applicatif idempotent :

```bash
npm run crm:legacy-migrate:dry-run
```

Regles du script :

- dry-run par defaut ;
- aucune ecriture sans `--apply` ;
- exclusion stricte des contacts `dedupe_status = IGNORED` ;
- blocage si un cas `AMBIGU` reste non ignore ;
- detection des leads deja crees par `source_table` + `source_id` ;
- creation de `leads`, `lead_status_history` et `communications` ;
- conservation des anciennes tables `contacts` et `estimations` ;
- rapport JSON dans `reports/`.

Resultat du dry-run connecte avant import du 16/07/2026 :

- 5 contacts lus ;
- 5 estimations lues ;
- 10 soumissions analysees ;
- 9 leads planifies ;
- 1 cas ignore : `contact:fdbaec34-e229-4035-9606-546f0f59c468` ;
- 0 bloqueur ;
- 0 ecriture.

Resultat de l'import reel du 16/07/2026 :

- 9 leads crees ;
- 0 contact supplementaire cree ;
- 9 entrees `lead_status_history` creees ;
- 9 communications initiales creees ;
- 1 run d'import trace dans `lead_import_runs`.

Resultat du dry-run post-import du 16/07/2026 :

- 9 leads legacy deja presents ;
- 0 lead a creer ;
- 1 cas ignore ;
- 0 bloqueur.

Migration de garde-fou appliquee le 16/07/2026 via Supabase SQL Editor :

```text
supabase/migrations/202607160002_legacy_lead_import_guardrails.sql
```

Elle ajoute un index unique partiel sur `leads(source_table, source_id)` pour renforcer la protection contre les doublons si l'import est relance.

Verification SQL :

- `leads_source_table_source_id_idx` present ;
- `leads_source_table_source_id_unique` present ;
- requete de verification sur `pg_indexes` : 2 lignes retournees.

Commande d'execution reelle, uniquement apres validation du rapport :

```bash
npm run crm:legacy-migrate
```

## Revue Applicative Legacy

Objectif : permettre une validation humaine avant toute migration reelle ou toute fusion definitive.

Ecran :

```text
/admin
Onglet : Revue legacy
```

Fonctionnement :

1. l'ecran charge les anciennes demandes `contacts` et `estimations` ;
2. il applique la meme logique de rapprochement que `npm run crm:legacy-dry-run` ;
3. il affiche les categories `MATCH CERTAIN`, `MATCH PROBABLE`, `AMBIGU`, `AUCUN MATCH` ;
4. il montre les cles de rapprochement : email, telephone, nom + ville ;
5. il permet d'ajouter une note de revue ;
6. il journalise une decision dans `lead_merge_logs`.

Decisions possibles :

- `Pret pour migration future` ;
- `A revoir manuellement` ;
- `Ne pas fusionner`.

Garanties :

- aucune migration reelle n'est executee directement par cet ecran ;
- aucune fusion automatique n'est faite ;
- aucune donnee legacy n'est supprimee ;
- les decisions sont tracees dans `lead_merge_logs` ;
- l'action est historisee dans `activities` et `audit_logs`.

Route API :

```text
GET /api/admin/legacy-review
PATCH /api/admin/legacy-review
```

Permissions :

- lecture : `crm.read` ;
- decision de revue : `lead.write`.

Le `PATCH` sert uniquement a journaliser une decision de revue. Il ne cree pas de contact canonique, ne cree pas de lead final et ne deplace aucune donnee legacy.

## Pipeline Commercial Quotidien

Objectif : transformer les leads importes en liste de travail exploitable au quotidien.

Ecran :

```text
/admin
Onglet : Pipeline
```

Fonctionnalites ajoutees :

- KPI leads actifs, rappels du jour, rappels en retard et leads non assignes ;
- plan de journee qui remonte les rappels en retard et les rappels du jour ;
- carte dediee aux rappels en retard ;
- assignation rapide des leads sans responsable ;
- suivi commercial par agent : charge active, rappels ouverts, retards, leads urgents, rendez-vous et mandats ;
- vue hebdomadaire des rappels ouverts ;
- rappels recurrents `Aucune`, `Hebdomadaire`, `Mensuelle` ;
- notification email preparee sur un rappel, sans envoi automatique ;
- filtres par texte, statut et agent ;
- modification rapide du statut commercial ;
- priorite `Faible`, `Normale`, `Haute`, `Urgente` ;
- assignation a un profil admin actif ;
- notes internes ;
- creation d'un rappel lie au lead ;
- cloture ou reouverture d'un rappel.
- journal d'activite filtre par defaut sur l'activite metier, avec option pour afficher ou isoler les traces de recette.

Route API :

```text
GET /api/admin/pipeline
POST /api/admin/pipeline
PATCH /api/admin/pipeline
```

Permissions :

- lecture : `crm.read` ;
- modification lead/rappel : `lead.write`.

Migration :

```text
supabase/migrations/202607160003_commercial_pipeline_foundation.sql
supabase/migrations/202607160004_crm_reminder_automation.sql
```

Ces migrations sont non destructives.

Elles ajoutent :

- `tasks.created_by` ;
- `tasks.completed_by` ;
- `tasks.task_type` ;
- `tasks.recurrence_rule` ;
- `tasks.reminder_channel` ;
- `tasks.email_reminder_enabled` ;
- `tasks.email_reminder_status` ;
- `tasks.email_reminder_scheduled_at` ;
- `tasks.email_reminder_sent_at` ;
- `tasks.email_reminder_last_error` ;
- contraintes de priorite non validees retroactivement ;
- index de lecture `leads` et `tasks` ;
- policies de lecture admin sur `leads`, `lead_status_history`, `tasks`, `communications` et `appointments`.

Recette manuelle recommandee :

1. ouvrir `/admin` avec un compte autorise ;
2. aller dans `Pipeline` ;
3. verifier les KPI leads actifs, aujourd'hui, en retard et non assignes ;
4. assigner un lead depuis `Assignation rapide` ;
5. changer son statut et sa priorite ;
6. creer un rappel date ;
7. verifier que le rappel apparait dans `Plan de journee` ou `Rappels en retard` selon l'echeance ;
8. creer un rappel recurrent hebdomadaire ou mensuel ;
9. creer un rappel avec `Email prepare` et verifier qu'il apparait dans la carte `Notifications email` ;
10. verifier la carte `Vue hebdomadaire` ;
11. terminer le rappel ;
12. verifier `Activites` avec le filtre `Activite metier` puis `Tout afficher` ;
13. verifier `audit_logs` si un controle technique est necessaire.

## Regle de securite

Aucune migration destructive Phase 3 ne doit etre lancee.

La migration Phase 3 appliquee est non destructive et conserve les anciennes tables `contacts` et `estimations` lisibles pendant la transition.

## Prochaine etape

Appliquer la migration `202607160004_crm_reminder_automation.sql` sur Supabase production, puis brancher un vrai fournisseur email avant tout envoi automatique. Ensuite, poursuivre vers assignation automatique par zone ou type de projet.
