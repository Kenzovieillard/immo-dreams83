# Instructions Projet IMMO-DREAMS83

## Bento Design CRM

Toutes les futures phases du CRM V3 doivent respecter le Bento Design System documente dans `docs/CRM_BENTO_DESIGN_SYSTEM.md`.

Regles principales :

- utiliser `BentoGrid`, `BentoCard`, `BentoKpiCard` et les etats Bento reutilisables pour les nouveaux modules CRM ;
- conserver une grille CSS 1 colonne mobile, 6 colonnes tablette, 12 colonnes desktop ;
- ne jamais utiliser Masonry ni `grid-auto-flow: dense` ;
- garder l'ordre DOM identique a l'ordre visuel et a l'ordre mobile ;
- justifier la taille de chaque carte par sa priorite metier ;
- placer les actions du jour et les leads urgents avant les statistiques secondaires ;
- conserver la palette IMMO-DREAMS83 : orange, jaune dore, blanc, noir charbon et sable chaud ;
- prevoir les etats loading, empty, error, permission denied et not configured ;
- ne jamais afficher de fausses donnees ou de statistiques de demonstration en production ;
- verifier le responsive a 320, 375, 390, 768, 1024, 1280 et 1440 px ;
- lancer `npm run lint` et `npm run build` avant toute livraison.
