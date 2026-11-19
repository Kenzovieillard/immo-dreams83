# Hebergement et Vercel

Ce dossier regroupe la documentation liee a l'hebergement, au build, aux variables d'environnement et a Vercel.

Fichiers actuels :

- `V2_5_SETUP.md`

Fichiers associes :

- `.vercel/`
- `next.config.ts`
- `.env.example`
- `package.json`

## Recette avant déploiement

Depuis `immo-dreams83`, exécuter `npm run verify:release` (`npm.cmd run verify:release` sous PowerShell). La commande vérifie le lint, les tests métier Commercial, Contacts et Carte des biens, puis le build de production, qui inclut TypeScript. Elle s'arrête au premier échec. Pendant un correctif, rejouer d'abord le test du module touché et réserver cette commande à la validation du lot.

Pour une modification qui touche les écritures CRM, les droits ou la synchronisation, lancer aussi la [recette E2E sur un projet Supabase isolé](../crm/COMMERCIAL_E2E.md). Avant de déployer, identifier le commit à livrer et vérifier les migrations dont il dépend. Sur la Preview Vercel, contrôler le parcours modifié avec le rôle concerné. Après publication, vérifier l'accueil, l'accès aux pages CRM et la réponse 401 des API protégées sans session. Conserver le lien du déploiement précédent pour pouvoir le rétablir.

## Mise en production Commercial du 18 novembre 2026

- Source publiée depuis la copie locale validée, HEAD `a1edac1` avec les changements Commercial. La commande de build utilise Webpack pour corriger l'échec de compilation d'Inter avec Turbopack sur Vercel.
- Déploiement `dpl_3qovmabvoCBbbmQi3HcYapouXu26` en état Ready, promu après contrôle sur son URL propre. [Déploiement Vercel](https://vercel.com/prism15/immo-dreams83/3qovmabvoCBbbmQi3HcYapouXu26)
- 15 contrôles HTTP réussis avant et après la bascule. L'accueil, le catalogue, la connexion et l'icône Filtres répondent en 200. Les cinq pages Commercial redirigent vers la connexion et les six API contrôlées répondent 401 sans session. La recette authentifiée avec écritures s'est déroulée sur Supabase isolé avec 35 contrôles réussis.
- Retour arrière applicatif possible vers `dpl_Dtny9HRQZtib2gfJ1goc4vFvQsaL`. La publication n'a appliqué aucune migration. [Déploiement précédent](https://immo-dreams83-kdi56d71k-prism15.vercel.app)

## Mise en production Biens du 18 novembre 2026

- Les migrations `202611180001` et `202611180002` sont appliquées et inscrites dans l'historique Supabase de production. Le contrôle avant/après retrouve 98 biens et les mêmes 36 annonces publiques. Le stockage documentaire est privé, les champs internes sont absents de la projection publique et la première exécution de Supabase Cron a réussi.
- Le déploiement initial `dpl_7Y5t1rhw22PrqpWZVG7Zo39cgAse` a été publié depuis la copie de travail validée, HEAD `a1edac1`. [Déploiement Vercel](https://vercel.com/prism15/immo-dreams83/7Y5t1rhw22PrqpWZVG7Zo39cgAse)
- Les 22 contrôles HTTP ont réussi avant et après la bascule. Les routes publiques répondent et les API Biens et Commercial contrôlées exigent une session. La recette authentifiée avec écritures a été exécutée sur Supabase isolé. [Guide Biens](../crm/PROPERTY_WORKSPACE.md)
- Le retour arrière applicatif cible `dpl_3qovmabvoCBbbmQi3HcYapouXu26`. Les migrations ajoutent des éléments de schéma compatibles avec cette version. [Déploiement précédent](https://immo-dreams83-iz9leklhq-prism15.vercel.app)

### Carte par commune

- Le déploiement `dpl_FbEgTJWwJXARAFjCbb2TdXuyMPAT` a mis en ligne la carte depuis la copie de travail validée, HEAD `a1edac1`, sans migration. [Déploiement Vercel](https://vercel.com/prism15/immo-dreams83/FbEgTJWwJXARAFjCbb2TdXuyMPAT)
- Les 23 contrôles HTTP ont réussi avant et après la bascule, dont la réponse 401 sans session du nouvel endpoint communes. Les 9 contrôles de recette Biens authentifiée ont réussi sur Supabase isolé. Le rapprochement en lecture seule sur le portefeuille de production a retrouvé 97 biens dans 25 communes et un code `00000` sans repère.
- Le retour arrière applicatif cible `dpl_7Y5t1rhw22PrqpWZVG7Zo39cgAse`. [Déploiement précédent](https://immo-dreams83-kn9qu80i9-prism15.vercel.app)

### Actions, brouillons et validation de publication

- La migration `202611180003_property_management_actions.sql` est appliquée et inscrite dans l’historique de production. Le contrôle a confirmé le stockage privé des fichiers de brouillons, l’accès aux actions SQL réservé au service serveur et le contrôle des pièces à l’échéance des publications programmées.
- Le déploiement `dpl_Bfj1rAazFviEKKk4WByvSNbxish6` est actif sur le domaine public. Source publiée depuis la copie de travail validée, HEAD `a1edac1`. [Déploiement Vercel](https://vercel.com/prism15/immo-dreams83/Bfj1rAazFviEKKk4WByvSNbxish6)
- Les 26 contrôles HTTP ont réussi avant et après la bascule. Les relevés de production totalisent 98 biens et 36 annonces publiques. La tâche de publication programmée a réussi. Les 11 contrôles Biens authentifiés avec écritures ont été effectués sur Supabase isolé.
- Le déploiement précédent est conservé. Dès qu’un plan cadastral a été enregistré, une version de retour doit savoir lire le type `cadastral_plan`. Conserver le stockage privé et la colonne `attachments` pour préserver les fichiers des brouillons sauvegardés. [Déploiement précédent](https://immo-dreams83-t0wrqjroz-prism15.vercel.app)
