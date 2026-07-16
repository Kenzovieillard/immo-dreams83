# V3 Phase 3 - CRM commercial

## Statut

Phase 3 demarree cote depot, mais pas encore applicable en production.

Pre-requis obligatoire :

1. terminer la Phase 2 Supabase ;
2. appliquer `supabase/migrations/202607150002_property_source_of_truth.sql` ;
3. lancer l'import reel des biens ;
4. valider RLS, `public_properties`, `property_photos` et la recette CRM.

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

Le cas ambigu doit etre traite manuellement avant migration effective.

## Regle de securite

Aucune ecriture Phase 3 ne doit etre lancee tant que la Phase 2 n'est pas mergee ou explicitement validee.

La migration Phase 3 peut etre relue et preparee, mais son application doit attendre la validation Phase 2.

## Prochaine etape

Appliquer la migration Phase 2, importer les biens, puis relancer le dry-run legacy avant de transformer les anciens contacts et estimations.
