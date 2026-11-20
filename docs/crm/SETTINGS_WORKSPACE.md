# Paramètres CRM Riviera

Ouvrir **Paramètres** depuis la barre latérale ou le menu **Plus** sur mobile. **Mon compte** ouvre directement la sécurité du compte connecté.

| Rubrique | Fonctionnement |
| --- | --- |
| Agence | La direction et les administrateurs éditent la fiche CRM. Le nom est repris dans le CRM et le Commercial. Les nouveaux PDF d’estimation utilisent la fiche d’agence. Le fuseau de référence est Europe/Paris et les montants sont en EUR. |
| Utilisateurs | La direction consulte l’annuaire et les connexions Supabase Auth. L’administrateur modifie le nom, le rôle et l’accès CRM d’un compte existant. L’accès propre et le dernier administrateur actif sont protégés. La création initiale d’un compte se fait dans Supabase Auth avec son profil CRM. |
| Rôles et accès | La matrice lit les permissions appliquées par le CRM. Les rôles système sont attribués depuis Utilisateurs. Le périmètre des dossiers reste régi par les contrôles métier. |
| Types, statuts et sources | Les listes présentent les valeurs utilisées par Biens, Contacts et Commercial et leurs effectifs. Les agents voient les effectifs de leur portefeuille. |
| Notifications | La cloche utilise les contacts attribués, estimations, visites, offres, rappels et tâches du compte. Le délai personnel sert lorsque l’activité ne porte pas de délai explicite. Le rapport hebdomadaire pointe vers les Statistiques de la semaine passée. La mise à jour de version utilise les variables serveur `CRM_RELEASE_PUBLISHED_AT` et `CRM_RELEASE_MESSAGE`. L’état lu et les préférences sont privés. |
| Intégrations | L’écran distingue Supabase opérationnel, configuration serveur détectée et raccordement requis. Les accès GA4 et Search Console se vérifient depuis l’analyse web. Les portails, Google Calendar, Mailchimp et la diffusion e-mail, push ou SMS des notifications demandent leurs accès et leurs règles de diffusion. |
| Import / Export | La direction importe jusqu’à 200 contacts par fichier CSV UTF-8. Le modèle fixe les colonnes et le CRM prévisualise avant de confirmer l’insertion. Le lot est transactionnel. Les adresses e-mail identiques ou les téléphones normalisés identiques sont ignorés. Les exports reprennent les parcours Contacts et Statistiques et leurs rôles. |
| Sécurité | Modifier son mot de passe, configurer le TOTP, voir les sessions et révoquer les autres appareils. Un facteur vérifié exige une session de niveau AAL2 lors des appels CRM. Les jetons d’accès déjà émis restent soumis à leur échéance Supabase. Le journal affiche les actions réelles selon le rôle. |

## Livraison

Appliquer `supabase/migrations/202611210001_crm_settings.sql` avant la promotion Vercel. Les tables de paramètres et fonctions de gestion sont réservées au service serveur. Les écritures de la fiche d’agence et des droits de l’équipe sont journalisées dans la même transaction.

Le chemin de connexion accepte les destinations internes CRM et Commercial. Le contrôle d’accès au CRM relit l’état et le rôle du profil Supabase à chaque session protégée.

## Recette

- `npm run test:crm-settings` vérifie les formulaires et le CSV.
- `npm run test:crm-e2e -- --settings` utilise le projet Supabase isolé pour vérifier l’agence, les rôles, la cloche, l’import, le mot de passe, les sessions et la connexion TOTP. Voir [la procédure CRM](COMMERCIAL_E2E.md).
- `npm run verify:release` exécute les tests des modules et le build Next.js.
