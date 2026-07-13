# Import biens officiels IMMO-DREAMS83

## Source

Les biens publics de la V2.5 proviennent des annonces officielles IMMO-DREAMS83 et sont actuellement versionnés dans `src/data/properties.ts`.

## Inventaire importé

| Référence | Type | Ville | Statut | Prix |
| --- | --- | --- | --- | --- |
| 099 | Maison | Carqueiranne | Disponible | 1 595 000 € |
| 67 | Maison | Toulon | Disponible | 830 000 € |
| 101 | Maison | Hyères | Sous offre | 379 000 € |
| 091 | Terrain | Pierrefeu-du-Var | Sous offre | 309 000 € |
| 093bis | Appartement | Solliès-Pont | Sous offre | 298 000 € |
| 066 | Terrain | Solliès-Pont | Disponible | 273 000 € |
| 103 | Appartement | Hyères | Disponible | 249 000 € |
| 102 | Appartement | Hyères | Disponible | 209 000 € |
| 098 | Appartement | Cuers | Sous offre | 170 000 € |
| 72 | Appartement | Toulon | Disponible | 167 000 € |
| 71 | Appartement | Toulon | Disponible | 144 000 € |
| 73 | Appartement | Toulon | Disponible | 79 000 € |

## Migration Supabase prévue

La table `properties` du fichier `supabase/schema.sql` est alignée avec le modèle TypeScript :

- références et mandats ;
- type, statut et transaction ;
- prix, surfaces et pièces ;
- diagnostics énergie/climat ;
- descriptions, photos et caractéristiques ;
- URL source officielle.

La V3 pourra remplacer la source `src/data/properties.ts` par Supabase, puis ajouter l'édition des biens, l'upload photo et les exports portails.

