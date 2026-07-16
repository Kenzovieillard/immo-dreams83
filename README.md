# IMMO-DREAMS83

Plateforme immobiliere responsive de l'agence IMMO-DREAMS83, situee a Sollies-Pont et specialisee dans la vente, l'achat et l'estimation de maisons, appartements et terrains dans le Var.

## Version actuelle

V3 phase 2 - CRM securise et Supabase source unique des biens.

Cette version conserve le socle V2.6, ajoute la securite admin V3 et branche le catalogue immobilier public sur Supabase comme source unique via la vue `public_properties`.

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
- source unique Supabase pour les biens publics ;
- vue publique `public_properties` sans colonnes internes ;
- statuts separes commercial/publication ;
- historique `property_history` ;
- photos normalisees dans `property_photos` avec corbeille et restauration technique ;
- script d'import idempotent des biens statiques historiques.

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
- catalogue public de biens lu depuis Supabase ;
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
4. Appliquer les migrations versionnees de `supabase/migrations` sur l'environnement de test.
5. Ne pas rejouer aveuglement `supabase/schema.sql` sur une base existante : ce fichier sert de reference globale.
6. Si Supabase CLI n'est pas disponible, appliquer uniquement les fichiers de migration necessaires dans SQL Editor.
7. Verifier que `public_properties`, `property_photos`, `property_history`, les policies RLS et le bucket `property-photos` existent.
8. Executer le dry-run d'import des biens, puis l'import reel si le rapport est correct.

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

1. Appliquer les migrations versionnees V3 necessaires dans Supabase.
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

## Importer les biens officiels

Simulation :

```bash
npm run properties:import:dry-run
```

Application :

```bash
npm run properties:import
```

Le script conserve les references et les slugs existants, puis ecrit un rapport JSON dans `reports/`.

## Preparer la Partie 3 CRM commercial

Avant de migrer `contacts` et `estimations` vers le futur modele `contacts` + `leads`, executer le rapport lecture seule :

```bash
npm run crm:legacy-dry-run
```

Ce script ne modifie pas Supabase. Il produit les rapprochements `MATCH CERTAIN`, `MATCH PROBABLE`, `AMBIGU` et `AUCUN MATCH`, puis simule les futurs payloads `contacts`, `leads`, `lead_status_history` et `communications`.

Pour conserver un rapport JSON local ignore par Git :

```bash
npm run crm:legacy-dry-run -- --write-report
```

## Statut de deblocage avant Partie 3

Statut actuel : **pas encore pret a implementer la Partie 3**.

La Partie 3 CRM commercial ne doit pas commencer tant que la Phase 2 n'est pas validee en environnement de test.

Blocages actuels :

- GitHub CLI `gh` est installe, mais pas encore authentifie : impossible de pousser la branche et d'ouvrir la PR depuis le terminal.
- Supabase CLI est accessible via `npx supabase`, mais pas encore authentifiee : les migrations ne peuvent pas encore etre appliquees/verifiees via CLI.
- `.env.local` est configure localement et ignore par Git, mais les appels Supabase depuis ce terminal echouent avec `fetch failed`.
- Le push Git echoue depuis ce terminal avec un blocage reseau vers `github.com:443`.
- La validation reelle RLS, import connecte et recette admin authentifiee doit etre relancee depuis un terminal ayant acces a Supabase et GitHub.

Actions a faire avant de declarer la Partie 3 prete :

1. Installer et connecter GitHub CLI, puis verifier :

```bash
gh auth status
```

Si le terminal courant ne retrouve pas encore `gh` apres installation Windows, ouvrir un nouveau terminal ou utiliser :

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' auth login
& 'C:\Program Files\GitHub CLI\gh.exe' auth status
```

2. Connecter Supabase CLI ou prevoir l'application manuelle migration par migration via SQL Editor.

```bash
npx supabase login
npx supabase projects list
```

3. Verifier `.env.local` a partir de `.env.example` avec les variables Supabase de test, sans jamais le commiter.
4. Relancer les rapports :

```bash
npm run properties:import:dry-run
npm run crm:legacy-dry-run -- --write-report
```

5. Appliquer l'import reel uniquement si le rapport biens ne signale aucun doublon reference, collision slug, perte photo ou statut inconnu.
6. Faire la recette Phase 2 : public, CRM, RLS, photos, publication, archivage, restauration, responsive mobile.
7. Pousser `feature/v3-supabase-property-source`, puis ouvrir la PR vers `main`.

Critere de sortie :

```text
PRET A IMPLEMENTER LA PARTIE 3
```

Ce statut ne doit etre declare qu'apres lint, build, import connecte, recette Supabase et PR Phase 2 ouverte ou validee.

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
- `src/data/properties.ts` reste seulement un seed d'import historique, pas une source publique de fallback ;
- la suppression definitive d'un bien complet n'est pas encore disponible dans le CRM ;
- la restauration visuelle des photos en corbeille n'a pas encore d'ecran dedie ;
- la carte presente une localisation indicative ;
- la multidiffusion portails n'est pas encore active ;
- l'aide DPE/GES ne remplace pas le diagnostic officiel fourni par un diagnostiqueur certifie.

## Prochaine amelioration

La suite V3 devra brancher les ecrans sur le modele CRM normalise : leads, taches, rappels, mandats, matching acquereurs, emails transactionnels, statistiques GA4 et exports portails.
