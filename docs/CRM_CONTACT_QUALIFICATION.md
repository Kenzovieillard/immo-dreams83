# Qualification des contacts CRM

## Objectif

Transformer les contacts importés ou entrants en prospects commerciaux exploitables, sans créer de doublons dans le pipeline.

## Parcours quotidien

1. Ouvrir **Contacts** depuis le CRM.
2. Traiter en priorité les fiches **À qualifier**.
3. Choisir le rôle : acquéreur, vendeur, acquéreur et vendeur, ou autre.
4. Définir le statut de qualification et confirmer si le contact est un prospect actif.
5. Cliquer sur **Valider la qualification**.
6. Pour un contact qualifié et actif, cliquer sur **Créer un prospect**.
7. Le CRM crée le prospect dans le pipeline et ajoute une première tâche d'appel à échéance courte.

## Règles automatiques

- Les rôles sont préremplis à partir du type de demande.
- Un contact sans téléphone ni adresse email réelle passe en **Sans moyen de contact**.
- Un contact archivé ou perdu passe en **Inactif**.
- Un doublon fusionné passe en **Doublon**.
- La validation humaine reste obligatoire avant la conversion en prospect.
- Un contact ne peut être relié qu'à un prospect actif à la fois.

## Priorités du jour

La vue d'ensemble remonte :

- les contacts à qualifier ;
- les contacts qualifiés prêts pour le pipeline ;
- les contacts sans moyen de contact ;
- les nouveaux prospects et les tâches commerciales déjà existantes.

## Données et migration

La migration `supabase/migrations/202607260001_contact_qualification_daily_crm.sql` ajoute les champs de qualification et la liaison entre `contacts` et `leads`. Elle est additive et conserve les données existantes.

## Limites actuelles

- La première tâche créée est un appel standard à une heure ; son canal et son échéance pourront devenir configurables.
- La qualification de masse n'est pas encore disponible.
- Les doublons restent validés individuellement avant fusion définitive.
