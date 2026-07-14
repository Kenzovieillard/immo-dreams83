# Import biens officiels IMMO-DREAMS83

## Source

Le catalogue public V2.5 est compose de deux sources :

1. les biens officiels initiaux versionnes dans `src/data/properties.ts` ;
2. les biens crees ou modifies depuis le CRM et stockes dans Supabase.

Les biens Supabase sont fusionnes avec le catalogue initial pour alimenter le site public.

## Inventaire initial importe

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

## Champs couverts par Supabase

La table `properties` couvre :

- reference et numero de mandat ;
- slug public ;
- titre ;
- type de bien : appartement, maison, terrain ;
- statut : disponible, sous offre, vendu ;
- ville et code postal ;
- prix affiche honoraires inclus ;
- surface habitable ou surface terrain ;
- pieces, chambres et salles d'eau ;
- DPE/GES ou mention "Non soumis" pour les terrains ;
- descriptions courte et complete ;
- atouts et options terrain ;
- photos ;
- mise en avant ;
- URL source si le bien vient d'une annonce existante.

## Gestion depuis le CRM

Le CRM permet maintenant :

- de creer un nouveau bien avec reference automatique ;
- de modifier un bien deja existant ;
- d'ajouter des photos depuis l'ordinateur ;
- de reordonner la galerie ;
- de choisir la photo principale ;
- de supprimer du Storage les photos retirees ;
- de passer un bien en disponible, sous offre ou vendu ;
- de le mettre ou retirer de la une.

## Limite V2.5

Les biens initiaux restent dans `src/data/properties.ts`. La V3 devra faire de Supabase la source unique du catalogue, avec import/export et historique complet.
