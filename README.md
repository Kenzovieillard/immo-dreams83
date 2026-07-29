# IMMO-DREAMS83

Application immobiliere Next.js de l'agence IMMO-DREAMS83 : site vitrine, catalogue de biens, formulaires, CRM admin, pipeline commercial et integration Supabase.

## Etat Actuel

Version de travail : V3 phase 3.

Le projet repose sur :

- Next.js App Router et TypeScript ;
- Tailwind CSS et composants UI internes ;
- Supabase pour les biens, contacts, estimations, leads, activites, photos et permissions ;
- Vercel pour l'hebergement ;
- une documentation sectorisee dans `docs/`.

## Architecture De Travail

La documentation est organisee selon cinq secteurs :

| Secteur | Role | Point d'entree |
| --- | --- | --- |
| Frontend | Pages, UI, design system, responsive, assets | `docs/frontend/README.md` |
| Backend | Routes API, logique serveur, scripts, integrations | `docs/backend/README.md` |
| CRM | Leads, contacts, pipeline, qualification, recettes | `docs/crm/README.md` |
| Base de donnees | Supabase, migrations, schema, imports | `docs/database/README.md` |
| Hebergement | Vercel, build, variables d'environnement | `docs/deployment/README.md` |

Carte technique complete : `docs/README.md`.

## Lancer Le Projet

```bash
npm install
npm run dev
```

Ouvrir ensuite `http://127.0.0.1:3000`.

## Scripts Utiles

```bash
npm run lint
npm run build
npm run properties:import:dry-run
npm run properties:import
npm run lesty:audit
npm run lesty:properties:dry-run
npm run lesty:properties:import
npm run lesty:contacts:dry-run
npm run lesty:contacts:import
npm run crm:legacy-dry-run
npm run crm:legacy-migrate:dry-run
npm run crm:legacy-migrate
```

## Configuration

Variables attendues :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Le modele public est dans `.env.example`.
Le fichier `.env.local` reste local et ne doit pas etre expose.

## Routes Principales

Pages publiques :

- `/`
- `/a-vendre`
- `/biens`
- `/biens/[slug]`
- `/agence`
- `/contact`
- `/estimation`

Administration :

- `/admin/login`
- `/admin`

Routes API principales :

- `/api/contact`
- `/api/estimation`
- `/api/admin/auth/login`
- `/api/admin/auth/logout`
- `/api/admin/leads`
- `/api/admin/pipeline`
- `/api/admin/properties`
- `/api/admin/property-photos`
- `/api/admin/legacy-review`

## Rapports

Les rapports generes par les scripts restent locaux par defaut.

- Les fichiers `reports/**/*.json` et `reports/**/*.log` sont ignores par Git.
- Le dossier `reports/` conserve seulement sa methode et son manifeste versionnes.
- Voir `reports/README.md` et `reports/MANIFEST.md`.

## Regles De Contribution

Avant une livraison :

```bash
npm run lint
npm run build
```

Pour une modification CRM, respecter le Bento Design System documente dans `docs/frontend/CRM_BENTO_DESIGN_SYSTEM.md`.

Ne pas melanger dans un meme commit :

- rangement/documentation ;
- refonte UI ;
- migration Supabase ;
- import de donnees ;
- changements d'animation ou d'assets hero.

## Documentation

- Organisation generale : `docs/README.md`
- Frontend : `docs/frontend/README.md`
- Backend : `docs/backend/README.md`
- CRM : `docs/crm/README.md`
- Base de donnees : `docs/database/README.md`
- Hebergement : `docs/deployment/README.md`
- Rapports : `reports/README.md`
