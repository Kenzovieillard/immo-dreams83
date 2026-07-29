# Manifeste Des Rapports

Derniere mise a jour : 2026-07-29

Ce manifeste remplace le versioning direct des gros rapports JSON et logs.

## Regle

- Les fichiers `reports/**/*.json` restent locaux.
- Les fichiers `reports/**/*.log` restent locaux.
- Git conserve uniquement ce manifeste et la methode de classement.

## Structure Locale

- `reports/imports/dry-runs/` : simulations d'import et migrations non appliquees.
- `reports/imports/applied/` : imports ou migrations appliquees.
- `reports/audits/` : audits et controles.
- `reports/audits/dev-server-logs/` : logs de serveurs de developpement.

## Lots Presents Localement Au 2026-07-29

Lots JSON identifies avant exclusion Git :

- Audit Lesty : 1 rapport.
- Imports appliques : 14 rapports.
- Simulations d'import et migration : 22 rapports.

Fichiers les plus volumineux observes :

- `lesty-properties-import-2026-07-17T01-18-06-646Z.json`
- `lesty-properties-import-2026-07-16T21-52-39-089Z.json`
- `lesty-properties-dry-run-2026-07-17T01-09-19-205Z.json`
- `lesty-properties-dry-run-2026-07-16T21-38-13-056Z.json`
- `lesty-properties-dry-run-2026-07-16T21-21-52-228Z.json`

## Consultation

Pour consulter les rapports locaux :

```bash
Get-ChildItem -Recurse reports
```

Pour voir les plus gros fichiers :

```bash
Get-ChildItem -Recurse reports -File | Sort-Object Length -Descending | Select-Object -First 15 FullName,Length
```
