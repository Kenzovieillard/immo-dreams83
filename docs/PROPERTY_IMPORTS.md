# Import biens officiels IMMO-DREAMS83

## Source V3 phase 2

Supabase est la source unique du catalogue public.

- Le site public lit la vue `public_properties`.
- Le CRM lit et modifie la table `properties` via les routes admin protegees.
- `src/data/properties.ts` reste un seed d'import temporaire, pas une source publique de fallback.
- Les photos sont normalisees dans `property_photos`; `properties.photos` reste conserve pour compatibilite de transition.

## Statuts

Deux statuts sont separes :

- statut commercial : `AVAILABLE`, `UNDER_OFFER`, `SOLD`;
- statut de publication : `DRAFT`, `PUBLISHED`, `UNPUBLISHED`, `ARCHIVED`.

Un bien public doit etre :

- `publication_status = 'PUBLISHED'`;
- non archive ;
- `status in ('available', 'under_offer')`.

## Import idempotent

Simulation :

```bash
npm run properties:import:dry-run
```

Application reelle :

```bash
npm run properties:import
```

Le script :

- lit les 12 biens initiaux depuis `src/data/properties.ts`;
- compare par `reference`;
- conserve les slugs existants;
- applique les statuts commerciaux et de publication;
- importe les photos dans `property_photos`;
- genere un rapport JSON dans `reports/`.

## Derniere application reelle

Application executee sur le projet Supabase cible le 16/07/2026 apres application des migrations versionnees Phase 1 et Phase 2.

Resultat :

- 12 biens analyses;
- 7 biens mis a jour;
- 5 biens crees;
- 13 biens presents au total dans `properties`;
- 12 biens importes depuis le seed historique;
- 12 biens visibles dans `public_properties`;
- 7 biens a la une;
- 48 photos actives;
- 12 photos principales;
- aucun doublon `reference`;
- aucun doublon `slug`;
- lecture anonyme directe de `properties` bloquee par RLS.

Rapports locaux generes dans `reports/` :

- dry-run biens connecte;
- import reel biens;
- dry-run legacy CRM.

## Inventaire initial

| Reference | Type | Ville | Statut | Prix |
| --- | --- | --- | --- | --- |
| 099 | Maison | Carqueiranne | Disponible | 1 595 000 EUR |
| 67 | Maison | Toulon | Disponible | 830 000 EUR |
| 101 | Maison | Hyeres | Sous offre | 379 000 EUR |
| 091 | Terrain | Pierrefeu-du-Var | Sous offre | 309 000 EUR |
| 093bis | Appartement | Sollies-Pont | Sous offre | 298 000 EUR |
| 066 | Terrain | Sollies-Pont | Disponible | 273 000 EUR |
| 103 | Appartement | Hyeres | Disponible | 249 000 EUR |
| 102 | Appartement | Hyeres | Disponible | 209 000 EUR |
| 098 | Appartement | Cuers | Sous offre | 170 000 EUR |
| 72 | Appartement | Toulon | Disponible | 167 000 EUR |
| 71 | Appartement | Toulon | Disponible | 144 000 EUR |
| 73 | Appartement | Toulon | Disponible | 79 000 EUR |

## Photos

Les nouvelles photos envoyees depuis le CRM sont stockees dans Supabase Storage, bucket `property-photos`.

La table `property_photos` gere :

- ordre de galerie;
- photo principale;
- statut `ACTIVE`, `TRASHED`, `PURGED`;
- restauration possible;
- date limite de restauration.

La suppression par defaut est logique : aucune suppression definitive n'est exposee dans le CRM.

## Retour arriere

Avant application production :

1. exporter `properties`, `property_photos`, `property_history`, `property_slug_history`;
2. exporter la liste des objets Storage du bucket `property-photos`;
3. executer d'abord `npm run properties:import:dry-run`;
4. conserver le rapport d'import.

Retour arriere applicatif :

- revert de la branche Phase 2;
- redeploiement Vercel du dernier commit stable.

Retour arriere donnees :

- ne pas supprimer les nouvelles colonnes;
- repasser un bien en `UNPUBLISHED` ou `ARCHIVED`;
- restaurer les photos marquees `TRASHED` si necessaire.
