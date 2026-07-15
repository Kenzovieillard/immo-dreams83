# IMMO-DREAMS83

Plateforme immobiliere responsive de l'agence IMMO-DREAMS83, situee a Sollies-Pont et specialisee dans la vente, l'achat et l'estimation de maisons, appartements et terrains dans le Var.

## Version actuelle

V3 foundation - CRM securise, roles admin et migrations Supabase versionnees.

Cette version conserve le socle V2.6 et ajoute la premiere fondation V3 : authentification CRM avec Supabase Auth, sessions serveur, roles, audit logs, migrations versionnees, lecture publique des biens via la cle anon et corbeille logique pour les photos retirees.

## Nouveautes V3 foundation

- page `/admin/login` avec connexion Supabase Auth ;
- protection serveur de `/admin` ;
- protection des routes `/api/admin/*` par session et permissions ;
- suppression de l'ancien code public `NEXT_PUBLIC_ADMIN_LOCAL_CODE` ;
- roles admin prepares : `ADMIN`, `DIRECTOR`, `AGENT`, `ASSISTANT`, `MARKETING`, `READ_ONLY` ;
- table `profiles` pour relier les utilisateurs Supabase Auth au CRM ;
- table `audit_logs` pour tracer les actions sensibles ;
- table `property_versions` pour historiser les modifications de biens ;
- table `property_photo_trash` pour eviter la suppression definitive immediate des photos ;
- migration versionnee dans `supabase/migrations` ;
- lecture publique des biens avec la cle anon et les policies RLS.

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
ADMIN_BOOTSTRAP_EMAILS=
CONTACT_RECEIVER_EMAIL=
EMAIL_FROM=
EMAIL_API_KEY=
```

La cle `SUPABASE_SERVICE_ROLE_KEY` reste strictement cote serveur. Elle permet aux routes API admin de lire et modifier les prospects, biens et photos apres verification de session et de role.

`ADMIN_BOOTSTRAP_EMAILS` sert a creer automatiquement le premier profil `ADMIN` lorsqu'un utilisateur Supabase Auth autorise se connecte pour la premiere fois. Exemple :

```text
ADMIN_BOOTSTRAP_EMAILS=antoine.faridoni@immo-dreams83.fr
```

## Comment utiliser le CRM

1. Executer `supabase/schema.sql` ou la migration V3 dans Supabase.
2. Creer un utilisateur dans Supabase Auth.
3. Ajouter son email dans `ADMIN_BOOTSTRAP_EMAILS`.
4. Ouvrir `/admin/login`.
5. Se connecter avec l'email et le mot de passe Supabase Auth.
6. Consulter les contacts, estimations, biens, activites et statistiques.
7. Modifier un statut, ajouter une note ou archiver un prospect.
8. Creer un contact manuel si une demande arrive par telephone ou en agence.
9. Creer ou modifier un bien avec prix FAI, statut, photos, DPE/GES, options terrain et mise en avant.
10. Verifier ensuite le rendu public sur Accueil, Biens et la fiche detail.

Sans Supabase Auth configure, le CRM n'est pas accessible. Le site public reste disponible.

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

`/admin` est protege par Supabase Auth. Les appels `/api/admin/*` refusent les requetes sans session CRM active et sans permission suffisante.

## Cartes et localisation

La page Contact utilise une carte Google Maps iframe basee sur l'adresse officielle de l'agence. Les fiches biens utilisent une localisation indicative basee uniquement sur la ville et le code postal, afin de ne pas exposer d'adresse privee.

## Statistiques

Les statistiques CRM sont calculees a partir des donnees locales ou Supabase deja disponibles. GA4 n'est pas encore connecte : les blocs de trafic web sont volontairement affiches comme a connecter pour une future integration Google Analytics Data API.

## Documentation

- Setup technique : `docs/V2_5_SETUP.md`
- Recette mobile et CRM : `docs/V2_5_RECETTE.md`
- Recette V2.6 : `docs/V2_6_RECETTE.md`
- Inventaire des annonces importees : `docs/PROPERTY_IMPORTS.md`
- Design system CRM Bento : `docs/CRM_BENTO_DESIGN_SYSTEM.md`
- Implementation CRM V3 : `docs/CRM_V3_IMPLEMENTATION.md`
- Objectifs V3 : `docs/V3.md`

## Verifications

```bash
npm run lint
npm run build
```

## Limites actuelles

- aucun fournisseur email reel n'est active ;
- GA4 n'est pas connecte ;
- Google Maps utilise des embeds iframe sans cle API ;
- le catalogue initial reste versionne dans `src/data/properties.ts`, meme si les nouveaux biens viennent de Supabase ;
- la suppression definitive d'un bien complet n'est pas encore disponible dans le CRM ;
- la restauration visuelle des photos en corbeille n'a pas encore d'ecran dedie ;
- la carte presente une localisation indicative ;
- la multidiffusion portails n'est pas encore active ;
- l'aide DPE/GES ne remplace pas le diagnostic officiel fourni par un diagnostiqueur certifie.

## Prochaine amelioration

La suite V3 devra brancher les ecrans sur le modele CRM normalise : leads, taches, rappels, mandats, matching acquereurs, emails transactionnels, statistiques GA4 et exports portails.
