# IMMO-DREAMS83 V2.5 - Setup technique

## Objectif

La V2.5 sert a rendre le site exploitable au quotidien avec un premier CRM : demandes clients, estimations, biens, photos, statuts et mise en avant. Elle reste volontairement simple : pas encore d'authentification complete, pas encore de suppression definitive des biens et pas encore d'envoi email reel.

## Architecture actuelle

- Site public : `src/app`
- Composants publics : `src/components/site`
- Formulaires : `src/components/forms`
- CRM : `src/components/admin/admin-dashboard.tsx`
- Routes API CRM : `src/app/api/admin`
- Routes API publiques : `src/app/api/contact` et `src/app/api/estimation`
- Donnees initiales des biens : `src/data/properties.ts`
- Schema Supabase : `supabase/schema.sql`

## Donnees agence

- Configuration agence : `src/components/site/site-config.ts`
- SEO et donnees structurees : `src/app/layout.tsx`, `src/lib/schema.ts`
- Pages legales : `src/app/mentions-legales`, `src/app/legal/privacy-policy`, `src/app/legal/cookies`

## Supabase

1. Creer ou ouvrir le projet Supabase.
2. Copier `.env.example` vers `.env.local`.
3. Remplir les variables Supabase et le bootstrap admin V3 si le CRM doit etre utilise.
4. Executer `supabase/schema.sql` dans l'editeur SQL Supabase.
5. Verifier les tables :
   - `contacts`
   - `estimations`
   - `properties`
   - `activities`
6. Verifier le bucket Storage :
   - `property-photos`

Le script SQL est concu pour etre relance : il utilise `create table if not exists`, `add column if not exists`, des index idempotents et des politiques RLS remplacees proprement.

## Variables attendues

```text
NEXT_PUBLIC_SITE_URL=https://immo-dreams83.vercel.app
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_BOOTSTRAP_EMAILS=
CONTACT_RECEIVER_EMAIL=
EMAIL_FROM=
EMAIL_API_KEY=
```

Important : `SUPABASE_SERVICE_ROLE_KEY` ne doit jamais etre exposee cote client. Elle est utilisee uniquement dans les routes API serveur.

## CRM V2.5 / V3 foundation

Le CRM est disponible sur `/admin` apres connexion via `/admin/login`.

Il permet de :

- consulter les contacts et estimations ;
- creer un contact manuel ;
- changer les statuts des leads ;
- ajouter des notes internes ;
- archiver un prospect ;
- voir l'activite recente ;
- creer un bien ;
- modifier un bien existant ;
- uploader des photos depuis un fichier local ;
- reordonner les photos ;
- choisir la photo principale ;
- placer en corbeille les photos retirees ;
- changer le statut d'un bien ;
- mettre ou retirer un bien de la selection a la une.

## Prix FAI

Dans le CRM, le champ "Prix affiche honoraires inclus" correspond au prix public affiche sur le site. C'est le prix de vente presente au visiteur, honoraires d'agence inclus. Il ne correspond pas aux frais de notaire.

## Limites actuelles

- La protection de `/admin` repose maintenant sur Supabase Auth.
- Les roles utilisateurs sont prepares pour le socle V3.
- L'envoi email est prepare mais aucun fournisseur n'est branche.
- La suppression complete d'un bien n'est pas encore exposee dans le CRM.
- La suppression photo passe par une corbeille logique, mais l'ecran de restauration reste a finaliser.
- Les biens initiaux restent versionnes dans `src/data/properties.ts`.

## Verifications

```bash
npm run lint
npm run build
```

Pour la validation fonctionnelle, utiliser `docs/V2_5_RECETTE.md`.
