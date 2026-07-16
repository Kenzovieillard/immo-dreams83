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

Migration de garde-fou a appliquer des que possible avec un acces SQL/CLI Supabase authentifie :

```text
supabase/migrations/202607160002_legacy_lead_import_guardrails.sql
```

Elle ajoute un index unique partiel sur `leads(source_table, source_id)` pour renforcer la protection contre les doublons si l'import est relance.

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

## Regle de securite

Aucune migration destructive Phase 3 ne doit etre lancee.

La migration Phase 3 appliquee est non destructive et conserve les anciennes tables `contacts` et `estimations` lisibles pendant la transition.

## Prochaine etape

Appliquer la migration de garde-fou `202607160002_legacy_lead_import_guardrails.sql` des qu'un acces SQL/CLI Supabase authentifie est disponible, puis poursuivre la Phase 3 sur les vues CRM quotidiennes : pipeline, taches, rappels et assignation.
