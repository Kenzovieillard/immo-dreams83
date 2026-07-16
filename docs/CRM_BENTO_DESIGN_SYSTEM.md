# CRM Bento Design System

## Objectif

Le CRM IMMO-DREAMS83 utilise un Bento Design fonctionnel : les cartes servent a prioriser les actions, organiser les informations et accelerer les decisions de l'agence. Le Bento n'est pas une decoration et ne doit pas remplacer les tableaux, formulaires ou listes quand ils sont plus efficaces.

## Grille

- Mobile `< 768 px` : 1 colonne, ordre DOM strictement identique a l'ordre visuel.
- Tablette `768-1023 px` : 6 colonnes.
- Desktop `1024-1279 px` : 12 colonnes adaptees.
- Large desktop `>= 1280 px` : 12 colonnes.

Regles :
- utiliser CSS Grid ;
- ne pas utiliser `grid-auto-flow: dense` ;
- ne pas utiliser de Masonry ;
- ne pas calculer la mise en page avec JavaScript ;
- garder une seule direction principale de scroll sur mobile.

## Composants

Les composants vivent dans `src/components/admin/bento`.

- `BentoGrid` : grille responsive 1 / 6 / 12 colonnes.
- `BentoCard` : carte structurelle avec titre, description, variante et span.
- `BentoKpiCard` : KPI court, utilisable dans une carte ou en grille.
- `BentoEmptyState` : etat vide non alarmiste.
- `BentoErrorState` : erreur lisible.
- `BentoPermissionState` : bloc non autorise.
- `BentoCardSkeleton` : chargement coherent.

## Etat Actuel De Migration

- Vue d'ensemble : migree en Bento, avec priorites metier, pipeline, portefeuille et activite recente.
- Statistiques : migrees en Bento, avec blocs analytiques plus hierarchises.
- Contacts : formulaire de creation et liste de prospects migres en Bento.
- Estimations : liste et filtres migres en Bento.
- Biens : creation, indicateurs, source catalogue, repartitions, recherche et liste migres en Bento.
- Activites : journal, filtres et etat vide migres en Bento.

La carte individuelle d'un bien reste un composant de travail dense car elle contient edition, disponibilite, mise a la une et gestion photos. Elle pourra etre extraite plus tard dans un composant dedie, mais elle ne doit pas devenir un simple bloc decoratif.

## Spans Autorises

- `small` : KPI ou statut court.
- `medium` : bloc d'analyse secondaire.
- `large` : liste ou analyse importante.
- `wide` : priorite metier, pipeline, graphique principal.
- `tall` : bloc vertical avec liste ou details.
- `full` : tableau, historique, module transverse.

La taille d'une carte doit toujours etre justifiee par son role metier.

## Variantes

- `default` : surface blanche standard.
- `highlight` : bloc prioritaire ou action du jour.
- `success` : resultat positif.
- `warning` : attention ou configuration partielle.
- `danger` : erreur ou risque.
- `muted` : information secondaire.

Ne pas multiplier les couleurs par carte. La palette reste celle d'IMMO-DREAMS83 : orange coucher de soleil, jaune dore, blanc, noir charbon et fonds sable chaud.

## Tokens

Tokens principaux dans `src/app/globals.css` :

- `--bento-gap`
- `--bento-card-radius`
- `--bento-card-padding`
- `--bento-card-border`
- `--bento-card-background`
- `--bento-card-muted-background`
- `--bento-card-shadow`

Les espacements sont adaptes par breakpoint. Les ombres restent legeres.

## Ordre De Priorite Dashboard

La vue d'ensemble doit repondre d'abord a la question :

> Que doit faire l'agence aujourd'hui ?

Ordre recommande :
1. priorites et actions du jour ;
2. leads urgents ou non traites ;
3. agenda et visites ;
4. mandats arrivant a echeance ;
5. pipeline commercial ;
6. portefeuille de biens ;
7. sources de leads ;
8. activites recentes ;
9. statistiques secondaires.

## Responsive

A verifier systematiquement :
- 320 px ;
- 375 px ;
- 390 px ;
- 768 px ;
- 1024 px ;
- 1280 px ;
- 1440 px.

Sur mobile :
- empiler dans l'ordre de priorite ;
- eviter les hauteurs fixes ;
- ne pas tronquer les textes importants ;
- garder les boutons accessibles au pouce ;
- ne jamais creer de scroll horizontal global.

## Accessibilite

- titres explicites ;
- ordre DOM logique ;
- boutons et liens reels ;
- `focus-visible` visible ;
- contrastes suffisants ;
- etats non transmis uniquement par la couleur ;
- cartes non cliquables quand elles contiennent plusieurs actions.

## Etats Obligatoires

Chaque module important doit pouvoir afficher :
- loading ;
- empty ;
- error ;
- success ;
- permission denied ;
- not configured.

Ne jamais afficher de fausses donnees ou des nombres aleatoires en production.

## Anti-Patterns

Interdits :
- dashboard generique de cartes identiques ;
- succession verticale sans hierarchie ;
- interface comptable froide ;
- Masonry ;
- `grid-auto-flow: dense` ;
- clone visuel d'un produit connu ;
- cartes sans objectif ;
- gradients ou effets excessifs ;
- animations permanentes.

## Exemple D'Utilisation

```tsx
<BentoGrid>
  <BentoCard span="wide" variant="highlight" title="Priorites du jour">
    <BentoEmptyState title="Aucune priorite bloquante" />
  </BentoCard>
  <BentoCard span="medium" title="Resume performance">
    <BentoKpiCard label="Leads actifs" value={12} />
  </BentoCard>
</BentoGrid>
```

## Checklist De Validation

- La hierarchie metier est immediate.
- La carte principale correspond a l'action prioritaire.
- Les cartes n'ont pas toutes la meme taille sans justification.
- Le DOM suit l'ordre visuel.
- Aucun Masonry ni placement dense.
- La page fonctionne a 320 px.
- Aucun scroll horizontal global.
- Le focus est visible.
- Les etats loading, empty et error existent.
- Aucune fausse donnee n'est affichee.
- Les tableaux restent des tableaux lorsque pertinent.
- La palette IMMO-DREAMS83 est respectee.
- `npm run lint` et `npm run build` passent.
