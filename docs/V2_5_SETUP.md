# IMMO-DREAMS83 V2.5 - Setup technique

## Objectif

Préparer une base propre pour exploiter les demandes clients, les estimations et le catalogue de biens officiels depuis Supabase, sans ajouter encore d'authentification complète ni de back-office d'édition.

## Données officielles

- Informations agence : `src/components/site/site-config.ts`
- Catalogue public : `src/data/properties.ts`
- Fondations de pilotage biens : `src/lib/property-management.ts`
- Statuts CRM partagés : `src/lib/crm.ts`

## Supabase

1. Créer un projet Supabase.
2. Copier `.env.example` vers `.env.local`.
3. Remplir les variables Supabase sans commiter `.env.local`.
4. Exécuter `supabase/schema.sql` dans l'éditeur SQL Supabase.
5. Vérifier que les tables `contacts`, `estimations`, `properties` et `activities` existent.

## CRM temporaire

Le CRM est disponible sur `/admin`.

- `NEXT_PUBLIC_ADMIN_LOCAL_CODE` sert uniquement de verrou temporaire.
- Les vraies règles de sécurité devront passer par une authentification V3.
- Les routes API utilisent `SUPABASE_SERVICE_ROLE_KEY` côté serveur pour lire et mettre à jour les prospects.

## Limites actuelles

- Les biens sont encore versionnés dans `src/data/properties.ts`.
- L'édition des biens depuis `/admin` n'est pas encore active.
- L'envoi email est préparé mais aucun fournisseur n'est branché.
- Le verrou CRM local ne remplace pas une authentification sécurisée.

## Tests

```bash
npm run lint
npm run build
```

