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

Aucune migration destructive Phase 3 ne doit etre lancee.

La migration Phase 3 appliquee est non destructive et conserve les anciennes tables `contacts` et `estimations` lisibles pendant la transition.

## Prochaine etape

Relire la PR Phase 2, merger vers `main`, redeployer Vercel, puis commencer la transformation applicative Phase 3 sans migration effective des anciens contacts et estimations tant que le cas `AMBIGU` n'est pas arbitre.
