# IMMO-DREAMS83

Plateforme immobiliere responsive de l'agence IMMO-DREAMS83, situee a Sollies-Pont et specialisee dans la vente, l'achat et l'estimation de maisons, appartements et terrains dans le Var.

## Version actuelle

V2.6 - CRM Dashboard, Maps & Responsive Polish.

Cette version ameliore le socle V2.5 avec un CRM plus confortable, une page d'accueil plus adaptative, des cartes Google Maps integrees et des statistiques admin plus utiles, sans supprimer les fonctionnalites deja en place.

## Fonctionnalites V2.6

- grille adaptative des biens a la une selon le nombre de biens mis en avant ;
- cartes de biens avec hauteur plus coherente et CTA aligne ;
- carte Google Maps sur la page Contact avec l'adresse officielle de l'agence ;
- carte Google Maps indicative sur les fiches biens avec ville et code postal uniquement ;
- layout CRM plus large avec navigation par onglets plus lisible sur mobile et desktop ;
- tableau de bord CRM en style bento ;
- statistiques CRM, portefeuille, villes, formulaires et activites plus completes ;
- journal d'activite searchable et filtrable ;
- emplacement prepare pour de futures statistiques GA4, sans fausses donnees.

## Socle V2.5 deja en place

- site vitrine premium avec pages Accueil, Agence, A vendre, Estimation, Biens et Contact ;
- catalogue public de biens officiels, complete par les biens crees dans Supabase ;
- fiches dynamiques avec galerie, diagnostics, partage, formulaire et biens similaires ;
- formulaires Contact et Estimation relies aux routes API et a Supabase ;
- mini-CRM sur `/admin` avec contacts, estimations, biens, activites et statistiques ;
- creation manuelle de contacts depuis le CRM ;
- creation et edition de biens avec reference automatique ;
- upload photo depuis fichiers locaux vers Supabase Storage ;
- gestion de galerie photo : photo principale, reordonnancement et suppression Storage des photos retirees ;
- pilotage de la disponibilite des biens : disponible, sous offre, vendu ;
- mise a la une des biens depuis le CRM ;
- aide DPE/GES par saisie numerique, avec formatage automatique ;
- mode terrain avec informations specifiques : bornage, constructibilite, viabilisation, acces, servitudes, risques et etude de sol ;
- correctifs responsive mobile, dont la prevention du zoom Safari sur les champs ;
- mentions legales, confidentialite, cookies, sitemap, robots et donnees structurees.

## Stack

- Next.js App Router et TypeScript ;
- Tailwind CSS et shadcn/ui ;
- Supabase pour les prospects, estimations, biens, activites et photos ;
- Vercel pour l'hebergement.

## Lancer le projet

```bash
npm install
npm run dev
```

Ouvrir ensuite `http://127.0.0.1:3000`.

## Configuration Supabase

1. Creer un projet Supabase.
2. Copier `.env.example` vers `.env.local`.
3. Renseigner les variables sans commiter `.env.local`.
4. Executer `supabase/schema.sql` dans l'editeur SQL Supabase.
5. Verifier que les tables `contacts`, `estimations`, `properties`, `activities` et le bucket `property-photos` existent.

Variables attendues :

```text
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_ADMIN_LOCAL_CODE=
CONTACT_RECEIVER_EMAIL=
EMAIL_FROM=
EMAIL_API_KEY=
```

La cle `SUPABASE_SERVICE_ROLE_KEY` reste strictement cote serveur. Elle permet au CRM de lire et modifier les prospects, biens et photos malgre les regles RLS.

## Comment utiliser le CRM

1. Ouvrir `/admin`.
2. Entrer la valeur de `NEXT_PUBLIC_ADMIN_LOCAL_CODE`.
3. Consulter les contacts, estimations, biens, activites et statistiques.
4. Modifier un statut, ajouter une note ou archiver un prospect.
5. Creer un contact manuel si une demande arrive par telephone ou en agence.
6. Creer ou modifier un bien avec prix FAI, statut, photos, DPE/GES, options terrain et mise en avant.
7. Verifier ensuite le rendu public sur Accueil, Biens et la fiche detail.

Sans Supabase, l'interface affiche le mode local et conserve les changements uniquement pendant la session courante.

## Routes importantes

- `/`
- `/agence`
- `/a-vendre`
- `/biens`
- `/biens/[slug]`
- `/estimation`
- `/contact`
- `/admin`
- `/mentions-legales`
- `/legal/privacy-policy`
- `/legal/cookies`

## CRM et administration

`/admin` reste protege par un code local temporaire. Il permet de gerer les contacts, estimations, biens, activites et statistiques. La V2.6 ameliore surtout la lecture operationnelle du CRM ; l'authentification complete avec roles reste prevue pour la V3.

## Cartes et localisation

La page Contact utilise une carte Google Maps iframe basee sur l'adresse officielle de l'agence. Les fiches biens utilisent une localisation indicative basee uniquement sur la ville et le code postal, afin de ne pas exposer d'adresse privee.

## Statistiques

Les statistiques CRM sont calculees a partir des donnees locales ou Supabase deja disponibles. GA4 n'est pas encore connecte : les blocs de trafic web sont volontairement affiches comme a connecter pour une future integration Google Analytics Data API.

## Documentation

- Setup technique : `docs/V2_5_SETUP.md`
- Recette mobile et CRM : `docs/V2_5_RECETTE.md`
- Recette V2.6 : `docs/V2_6_RECETTE.md`
- Inventaire des annonces importees : `docs/PROPERTY_IMPORTS.md`
- Objectifs V3 : `docs/V3.md`

## Verifications

```bash
npm run lint
npm run build
```

## Limites actuelles

- la protection de `/admin` est temporaire et ne remplace pas une authentification ;
- aucun fournisseur email reel n'est active ;
- GA4 n'est pas connecte ;
- Google Maps utilise des embeds iframe sans cle API ;
- le catalogue initial reste versionne dans `src/data/properties.ts`, meme si les nouveaux biens viennent de Supabase ;
- la suppression definitive d'un bien complet n'est pas encore disponible dans le CRM ;
- la suppression photo est definitive, sans corbeille temporaire ;
- la carte presente une localisation indicative ;
- la multidiffusion portails n'est pas encore active ;
- l'aide DPE/GES ne remplace pas le diagnostic officiel fourni par un diagnostiqueur certifie.

## Prochaine amelioration

La V3 devra transformer ce socle en vrai outil d'exploitation : authentification, roles et permissions, emails transactionnels, integration GA4, suppression controlee avec corbeille, rappels commerciaux, preparation des flux portails et fondation d'export multidiffusion.
