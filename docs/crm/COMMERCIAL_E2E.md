# CRM Commercial — recette E2E isolée

La commande `npm.cmd run test:crm-e2e` exécute le parcours réel suivant :

```text
Contact → Estimation → Bien → Pipeline → Visite → Offre
→ Négociation → Contre-proposition/décision → Nouvelle offre
```

Elle couvre également le rollback transactionnel, un appel concurrent de transformation, les erreurs métier, les documents privés, le Realtime PostgreSQL, les statistiques, les rôles, les RPC sensibles, les pages authentifiées dans Chrome et le nettoyage dans un bloc `finally`.

Depuis septembre 2026, le Realtime inclut deux sessions distinctes (administrateur et lecture seule), changements d'étape et classement, brouillons préservés, coupure réseau, SSE indisponible avec relecture de secours, renouvellement du flux et notes de négociation. Voir [COMMERCIAL_REALTIME_20260918.md](COMMERCIAL_REALTIME_20260918.md). L'abonnement attend la confirmation PostgreSQL, pas uniquement l'ouverture du canal.

## Garde-fous

Extension du 26 septembre : listes filtrées et fiches Estimations/Visites/Offres synchronisées entre administrateur et READ_ONLY, brouillons protégés, sept largeurs sans débordement, calendrier après coupure réseau, compte rendu et erreurs API récupérables. Voir [COMMERCIAL_REALTIME_MODULES_20260926.md](COMMERCIAL_REALTIME_MODULES_20260926.md).

Le runner refuse de démarrer si :

- `CRM_E2E_ALLOW_MUTATIONS` ne vaut pas exactement `isolated-project` ;
- le nom du projet ne respecte pas `immo-dreams83-e2e-<timestamp>` ;
- l'URL et la référence Supabase ne correspondent pas ;
- le projet n'est pas visible dans le compte authentifié par la CLI Supabase ;
- le nom déclaré ne correspond pas au nom réellement retourné par Supabase ;
- la référence E2E est celle du projet de production lié dans `supabase/.temp/project-ref`.

Il ne doit jamais être exécuté contre la production. Le projet cible doit être un projet Supabase temporaire contenant `supabase/schema.sql`, puis toutes les migrations du dépôt. La CLI Supabase `2.116.0` est épinglée par le runner et doit être authentifiée (`npx.cmd supabase@2.116.0 login`) avant la recette.

La création du projet temporaire reste une action manuelle : elle peut avoir un coût et ne doit pas être automatisée depuis ce script. Une fois le projet créé, appliquer le schéma et les migrations uniquement sur sa référence, puis contrôler sa présence avec :

```powershell
npx.cmd supabase@2.116.0 projects list --output json
```

## Variables requises

```text
CRM_E2E_PROJECT_REF
CRM_E2E_PROJECT_NAME
CRM_E2E_SUPABASE_URL
CRM_E2E_SUPABASE_ANON_KEY
CRM_E2E_SUPABASE_SERVICE_ROLE_KEY
CRM_E2E_ALLOW_MUTATIONS=isolated-project
CRM_E2E_PORT=3042                     # facultatif
CRM_E2E_SUPABASE_CLI_PATH             # chemin vers le binaire natif 2.116.0 sous Windows
```

Les communications transactionnelles restent désactivées pendant la recette. En environnement configuré, les noms exacts sont `CRM_TRANSACTIONAL_COMMUNICATION_WEBHOOK_URL` et `CRM_TRANSACTIONAL_COMMUNICATION_WEBHOOK_TOKEN`.

Ne jamais versionner ces valeurs ni les afficher dans les logs. Après configuration du processus local :

```powershell
npm.cmd run test:crm-e2e
```

Le résultat attendu se termine par :

```text
Interface authentifiée        PASS
Préremplissage UI             PASS
Cleanup                       PASS
Statistiques après cleanup    PASS
```

Le runner supprime uniquement les UUID collectés et les relations retrouvées depuis ses contacts temporaires `E2E_CRM_<timestamp>`. Une fois la recette terminée, supprimer séparément le projet Supabase temporaire.

Sous Windows, définir `CRM_E2E_SUPABASE_CLI_PATH` vers le `supabase.exe` installé par la CLI épinglée : le runner vérifie sa version et l'exécute directement, sans shell. Les requêtes SQL utilisent `--linked --project-ref <référence E2E explicite>` ; le fichier de liaison du dépôt n'est pas modifié. Le serveur Next écoute uniquement sur `127.0.0.1`.

Chaque exécution ayant atteint le scénario conserve un rapport sans secrets dans `work/commercial-e2e/E2E_CRM_<timestamp>.json`, y compris en cas d'échec. Les clés sont fournies uniquement par l'environnement du processus, jamais dans un fichier versionné.

Résultat de la recette persistée du 9 septembre 2026 : voir [COMMERCIAL_E2E_20260909.md](COMMERCIAL_E2E_20260909.md).
