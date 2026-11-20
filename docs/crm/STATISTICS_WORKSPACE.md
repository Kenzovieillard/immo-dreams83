# Statistiques CRM Riviera

Le module est accessible depuis **Statistiques** dans le CRM. Il propose dix rapports, un filtre par période et conseiller, des graphiques consultables au clavier et un export CSV du rapport affiché. Les dates sont inclusives en heure de Paris. La comparaison utilise les jours précédents sur une durée identique. Certaines cartes décrivent la situation actuelle, indiquée dans leur légende.

## Sources et formules

| Rapport | Données et calcul |
| --- | --- |
| Vue générale | Contacts uniques créés et qualifiés à leur date de qualification, estimations réalisées, mandats signés, visites réalisées et actes de vente datés. Le graphique Pipeline présente les étapes actuelles des dossiers acquéreurs de la période. Les recherches et dossiers dédupliquent un demandeur par commune souhaitée. |
| Performance commerciale | Une vente actée correspond à un bien, une date, un prix signé et des honoraires HT renseignés. Le CA affiché additionne ces honoraires déclarés. Le taux de transformation rapporte les ventes liées aux dossiers acquéreurs créés sur la période à ces dossiers. Le délai moyen utilise la date de publication enregistrée pour les ventes datées qui disposent de cette donnée. |
| Performance vendeurs | Le portefeuille du conseiller est défini par l’affectation enregistrée pour chaque objet. Les contacts traités correspondent à des communications sortantes ou à un dernier contact tracé, comptés une fois par contact. Les ratios du profil de compétences suivent le taux de contact, l’acceptation des offres, les ventes et la qualification. |
| Analyse contacts | L’entonnoir suit la cohorte d’acquisition jusqu’à la fin de la période sélectionnée. Le temps de réponse moyen utilise la première interaction tracée après la création, parmi les appels, e-mails et rendez-vous consignés ainsi que les communications sortantes. Les imports sont identifiés dans les sources. |
| Analyse pipeline | Le stock courant compte les biens non vendus et non archivés. Sa valeur agrège le prix affiché des biens rattachés à un mandat actif. La série temporelle suit les ouvertures de dossiers. Les alertes de blocage proviennent du pipeline. |
| Analyse estimations | Les demandes sont datées de leur réception. Une réalisation utilise le rapport ou le rendez-vous pour les statuts réalisés. La conversion utilise les mandats signés reliés au dossier ou au bien transformé. La valeur estimée utilise la valeur enregistrée ou le milieu de la fourchette. |
| Analyse visites | La date est celle du créneau. Le rang est calculé sur les visites réalisées du couple contact et bien. Le taux visite → offre utilise le lien explicite de l’offre avec la visite. Les prochaines visites décrivent la situation actuelle. |
| Analyse biens | Le stock actif compte les biens publiés et réservés inclus. Les prix sont ceux du catalogue CRM. La durée de commercialisation commence à la date de publication enregistrée. Les alertes d’inactivité se fondent sur la dernière visite réalisée ou la publication. |
| Points à surveiller | Les estimations sans suivi à 10 jours, les tâches en retard et les baisses du taux de transformation alimentent les alertes critiques. Les contacts sans relance à 5 jours et les biens sans visite à 30 jours alimentent les alertes modérées. Le score santé exprime la part du stock actif sans alerte d’inactivité. |
| Analyse site web | Google Analytics Data API fournit les sessions, utilisateurs, pages par session, rebond, durée, canaux, pages, appareils et événements clés. Google Search Console fournit les requêtes principales, clics, impressions, position et CTR. |

L’interface affiche un tiret quand la donnée, le dénominateur ou le droit manque. La couverture du registre indique les biens marqués vendus dont l’acte reste à renseigner. Les offres confidentielles et les montants sont accessibles aux rôles commerciaux, avec un périmètre individuel pour un agent. La direction et les administrateurs peuvent saisir ou corriger un acte depuis **Performance commerciale**.

## Activation

1. Appliquer `supabase/migrations/202611200001_crm_statistics_sales.sql` avant la publication. La table et la fonction d’écriture sont réservées au service serveur. La migration crée le registre à partir duquel les actes sont renseignés.
2. Renseigner les actes historiques dans **Saisir une vente** à partir des documents signés. Le registre conserve la date, le prix et les honoraires HT déclarés par l’agence.
3. Pour le site web, activer Analytics Data API et Search Console API. Donner au compte de service l’accès lecteur à la propriété GA4 et l’accès requis au site Search Console. Configurer `CRM_GA4_PROPERTY_ID` avec l’identifiant numérique, `CRM_SEARCH_CONSOLE_SITE` avec la valeur exacte de la propriété, `CRM_GOOGLE_SERVICE_ACCOUNT_EMAIL` et `CRM_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` dans les variables serveur. Les conversions reflètent les événements marqués comme clés dans GA4. Chacune des deux sources affiche un état de connexion indépendant.

## Recette

- `npm run test:crm-statistics` valide périodes, calculs, périmètres, export et contrat Google avec réponses simulées.
- `npm run verify:release` lance le lint, les suites CRM et le build de production.
- `npm run test:crm-e2e -- --statistics` vérifie le module dans le navigateur et l’enregistrement d’un acte sur le projet de recette isolé configuré selon [la procédure CRM](COMMERCIAL_E2E.md).
