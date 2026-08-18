# CRM Commercial — recette E2E isolée

La commande `npm.cmd run test:crm-e2e` exécute le parcours réel suivant :

```text
Contact → Estimation → Bien → Pipeline → Visite → Offre
→ Négociation → Contre-proposition/décision → Nouvelle offre
```

Elle couvre également le rollback transactionnel, un appel concurrent de transformation, les erreurs métier, les documents privés, le Realtime PostgreSQL, les statistiques, les rôles, les RPC sensibles, les pages authentifiées dans Chrome et le nettoyage dans un bloc `finally`.

## Garde-fous

Le runner refuse de démarrer si :

- `CRM_E2E_ALLOW_MUTATIONS` ne vaut pas exactement `isolated-project` ;
- le nom du projet ne respecte pas `immo-dreams83-e2e-<timestamp>` ;
- l'URL et la référence Supabase ne correspondent pas ;
- la référence E2E est celle du projet de production lié dans `supabase/.temp/project-ref`.

Il ne doit jamais être exécuté contre la production. Le projet cible doit être un projet Supabase temporaire contenant `supabase/schema.sql`, puis toutes les migrations du dépôt.

## Variables requises

```text
CRM_E2E_PROJECT_REF
CRM_E2E_PROJECT_NAME
CRM_E2E_SUPABASE_URL
CRM_E2E_SUPABASE_ANON_KEY
CRM_E2E_SUPABASE_SERVICE_ROLE_KEY
CRM_E2E_ALLOW_MUTATIONS=isolated-project
CRM_E2E_PORT=3042                     # facultatif
```

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
