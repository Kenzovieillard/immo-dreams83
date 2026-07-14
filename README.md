# IMMO-DREAMS83

Plateforme immobilière responsive de l'agence IMMO-DREAMS83, située à Solliès-Pont et spécialisée dans la vente et l'estimation de maisons, appartements et terrains dans le Var.

## Fonctionnalités V2.5

- site vitrine premium avec pages Accueil, Agence, À vendre, Estimation, Biens et Contact ;
- catalogue de 12 biens issus des annonces officielles de l'agence ;
- fiches dynamiques avec galerie, diagnostics, partage, formulaire et biens similaires ;
- formulaires Contact et Estimation reliés à des routes API ;
- préparation Supabase pour prospects, estimations, biens et activité ;
- mini-CRM local sur `/admin` avec pipeline, notes, archivage, inventaire biens et création de biens ;
- création de biens avec référence automatique, upload photo Supabase et aide DPE/GES ;
- mentions légales, confidentialité, cookies, sitemap, robots et données structurées.

## Stack

- Next.js App Router et TypeScript strict ;
- Tailwind CSS et shadcn/ui ;
- Supabase pour les prospects, l'activité et la future gestion des biens ;
- Vercel pour l'hébergement.

## Lancer le projet

```bash
npm install
npm run dev
```

Ouvrir ensuite `http://127.0.0.1:3000`.

## Configuration Supabase

1. Créer un projet Supabase.
2. Copier `.env.example` vers `.env.local`.
3. Renseigner les variables suivantes sans commiter `.env.local` :

```text
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_ADMIN_LOCAL_CODE=
```

4. Exécuter le fichier `supabase/schema.sql` dans l'éditeur SQL Supabase.

La clé `SUPABASE_SERVICE_ROLE_KEY` reste strictement côté serveur. Elle permet au CRM de lire et modifier les prospects malgré les règles de sécurité RLS.

## Comment utiliser le CRM

1. Ouvrir `/admin`.
2. Entrer la valeur de `NEXT_PUBLIC_ADMIN_LOCAL_CODE`.
3. Consulter les contacts, estimations, biens, activités et statistiques.
4. Modifier un statut, ajouter une note ou archiver un prospect.
5. Créer un bien avec ses photos, ses informations commerciales et son diagnostic DPE/GES.

Sans Supabase, l'interface affiche le mode local et conserve les changements uniquement pendant la session courante.

Si `NEXT_PUBLIC_ADMIN_LOCAL_CODE` n'est pas configuré, l'administration reste verrouillée et affiche un état de configuration requise.

## Documentation V2.5

- Setup technique : `docs/V2_5_SETUP.md`
- Inventaire des annonces importées : `docs/PROPERTY_IMPORTS.md`

## Vérifications

```bash
npm run lint
npm run build
```

## Limites actuelles

- la protection de `/admin` est temporaire et ne remplace pas une authentification ;
- aucun fournisseur d'email n'est activé ;
- le catalogue initial reste versionné dans `src/data/properties.ts` ;
- l'édition complète et la suppression des biens ne sont pas encore disponibles dans le CRM ;
- la carte présente une localisation indicative ;
- l'aide DPE/GES du CRM ne remplace pas le diagnostic officiel fourni par un diagnostiqueur certifié.

## Prochaine amélioration

La V3 devra ajouter une authentification avec rôles, l'édition/suppression des biens, l'envoi d'emails transactionnels et les flux de multidiffusion vers les portails immobiliers.
