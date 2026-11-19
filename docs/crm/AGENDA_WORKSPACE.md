# Agenda et tâches du CRM Riviera

Le module est accessible depuis **Agenda** dans la navigation du CRM ou via `/admin?tab=agenda`. Il réutilise les rendez-vous, estimations et tâches de Supabase. Les vues Jour, Semaine, Mois et Tâches partagent le filtre par responsable. Les dates et la sélection de l’activité figurent dans l’URL.

[Maquette Figma du module](https://www.figma.com/design/SpVkWha471bhFHLwc1l8TA/IMMO-DREAMS83---Accueil-Riviera-FIND?node-id=250-5649)

## Règles mises en œuvre

- L’horloge de référence est **Europe/Paris**. La semaine commence le lundi et affiche sept jours. Le calendrier affiche les créneaux hors des horaires habituels quand il y a une activité. La saisie est contrôlée lors des changements d’heure. Lors de l’heure répétée en automne, la première occurrence est retenue.
- La Direction et les Administrateurs peuvent consulter et réattribuer les activités de l’équipe. Les Conseillers et l’Assistance écrivent dans leur propre périmètre. Les autres profils disposent d’un accès en lecture seule à leur agenda. Le serveur contrôle l’accès aux activités et à leurs relations, y compris par lien direct.
- Le chevauchement d’activités ouvertes d’un même responsable est signalé avec l’horaire concerné. L’utilisateur peut confirmer l’enregistrement. Le report s’effectue depuis le formulaire et modifie le même objet. Une révision concurrente exige une actualisation.
- La visite utilise le même rendez-vous que le module Commercial. Le compte rendu se saisit dans Commercial après la visite. L’option de relance du lendemain crée une seule tâche interne à 9 h, révisée avec la visite. Annuler la visite neutralise cette tâche si elle est ouverte.
- L’estimation se planifie sur une demande existante. Le type de bien et la surface sont issus de cette demande. Annuler son rendez-vous laisse l’événement dans l’Agenda pour l’historique et rend la demande de nouveau planifiable.
- Une tâche peut rester sans échéance. Un rappel nécessite une date et une heure. L’état de retard dépend de l’heure et de l’état réel. Une tâche terminée peut être rouverte.
- Les rappels internes sont calculés à partir du créneau ou de l’échéance canonique. Ils apparaissent dans l’Agenda ouvert pour le périmètre sélectionné. L’envoi d’un e-mail passe par le logiciel de messagerie de l’utilisateur, avec destinataire visible et message modifiable. Les SMS, notifications mobiles, envois automatiques et calendriers externes demandent une intégration et des règles validées.
- Une signature enregistre un rendez-vous de signature, les parties et la liste des pièces. Les changements de statut de l’événement n’entraînent pas de progression automatique du pipeline.
- L’annulation garde l’activité et son historique. La suppression, réservée à la Direction et aux Administrateurs, exige une confirmation et est bloquée pour une visite, une estimation ou une activité portant un lien commercial à conserver.

## Données et déploiement

Appliquer `supabase/migrations/202611190001_agenda_workspace.sql` avant de promouvoir le code sur Vercel. La migration étend les référentiels et stocke les réglages d’Agenda sur `appointments`, `estimations` et `tasks`. Les mutations sont atomiques, enregistrent leur historique et utilisent une clé idempotente liée à l’acteur. Le journal des clés conserve un condensat de la demande.

Le module n’utilise aucune donnée de démonstration. Les indisponibilités de Supabase et les refus d’accès remontent dans l’interface.

## Recette

- `npm run verify:release` lance notamment les cas Agenda de fuseau, de plages, de rappels, de relations et d’échéances.
- Sur le projet isolé configuré selon [la procédure E2E CRM](COMMERCIAL_E2E.md), lancer `npm run test:crm-e2e -- --agenda`. Le scénario teste les écritures et les droits, reprend les mêmes objets dans Commercial, vérifie les quatre vues et le responsive, puis supprime ses données.
