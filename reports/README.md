# Rapports

Ce dossier contient les traces d'execution, d'audit et d'import.

## Structure

- `imports/dry-runs/` : simulations sans application en base.
- `imports/applied/` : imports, migrations appliquees ou rapports d'import final.
- `audits/` : audits et controles techniques.

## Regle

Les scripts peuvent encore produire de nouveaux rapports directement dans `reports/`. Quand une serie est terminee, classer les fichiers dans le sous-dossier adapte.

Les fichiers generes restent locaux :

- `reports/**/*.json` est ignore par Git ;
- `reports/**/*.log` est ignore par Git ;
- seul `reports/README.md` et `reports/MANIFEST.md` doivent etre versionnes.

Le manifeste sert a conserver une trace lisible sans alourdir Git avec les exports complets.
