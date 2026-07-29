# Recette V2.5 - Mobile et CRM

## Objectif

Valider que la V2.5 peut etre utilisee en conditions reelles par l'agence et par un visiteur mobile. La recette doit etre faite sur desktop et sur telephone, avec une attention particuliere a Safari iPhone.

## Environnement

- Site production : `https://immo-dreams83.vercel.app`
- CRM : `https://immo-dreams83.vercel.app/admin`
- Base : Supabase production
- Navigateur mobile prioritaire : Safari iPhone

## Pre-requis

- Variables Vercel configurees.
- `supabase/schema.sql` execute.
- Bucket `property-photos` present.
- Code CRM local connu par l'administrateur.
- Au moins un bien disponible dans le catalogue.

## Recette mobile publique

| Parcours | Test | Resultat attendu |
| --- | --- | --- |
| Accueil | Ouvrir la page sur iPhone | Pas de debordement horizontal, menu lisible, CTA visibles |
| Recherche | Toucher "Ville ou secteur" | Aucun zoom persistant apres saisie ou validation |
| Recherche | Remplir type, ville, budget, surface | Les champs restent lisibles et utilisables a une main |
| Navigation | Ouvrir le menu mobile | Les liens Accueil, Agence, A vendre, Estimation, Biens, Contact sont accessibles |
| Biens | Ouvrir `/biens` | Les cartes sont empilees proprement |
| Fiche bien | Ouvrir un bien | Galerie, prix, details, DPE et formulaire lisibles |
| Estimation | Remplir et envoyer le formulaire | Message de succes visible |
| Contact | Remplir et envoyer le formulaire | Message de succes visible |

## Recette CRM leads

| Parcours | Test | Resultat attendu |
| --- | --- | --- |
| Acces | Ouvrir `/admin` sans code | Ecran verrouille |
| Acces | Entrer le bon code | CRM accessible |
| Contact public | Envoyer un formulaire Contact | Le prospect apparait dans l'onglet Contacts |
| Estimation publique | Envoyer une estimation | La demande apparait dans Estimations et cree un contact miroir |
| Contact manuel | Creer un contact depuis le CRM | Le contact apparait en haut de liste |
| Statut | Passer un prospect en "Contacte" | Le statut est sauvegarde |
| Notes | Ajouter une note interne | La note reste apres sauvegarde |
| Archivage | Archiver un prospect | Il disparait de la vue active |

## Recette CRM biens

| Parcours | Test | Resultat attendu |
| --- | --- | --- |
| Creation | Creer un appartement | Une reference automatique est attribuee |
| Creation terrain | Creer un terrain | Les champs terrain s'affichent, DPE/GES non soumis |
| Photos | Ajouter plusieurs photos locales | Les photos sont envoyees vers Supabase Storage |
| Galerie | Reordonner les photos | La premiere photo devient la photo principale |
| Galerie | Supprimer une photo puis sauvegarder | La photo retiree est supprimee du Storage |
| Edition | Modifier titre, prix, statut, description | Les changements sont sauvegardes |
| Statut | Passer un bien en vendu | Le statut est visible dans le CRM et le bien sort du public si applicable |
| Mise en avant | Cocher "Afficher a la une" | Le bien apparait dans le bloc d'accueil |
| Mise en avant vide | Retirer tous les biens a la une | Le bloc d'accueil ne doit pas apparaitre |
| Recherche CRM | Rechercher par reference, ville ou titre | La liste filtre correctement |

## Recette responsive CRM

| Zone | Test | Resultat attendu |
| --- | --- | --- |
| Onglets CRM | Faire defiler les onglets sur mobile | Pas de blocage horizontal |
| Creation bien | Remplir le formulaire sur iPhone | Pas de zoom persistant |
| Edition bien | Ouvrir une fiche et modifier | Boutons et champs utilisables au doigt |
| Galerie photo | Utiliser monter, descendre, etoile, supprimer | Les boutons sont assez grands |

## Validation technique

```bash
npm run lint
npm run build
```

## Critere de sortie V2.5

La V2.5 peut etre consideree comme prete lorsque :

- les formulaires publics alimentent Supabase ;
- le CRM affiche les leads et biens ;
- la creation et l'edition de biens fonctionnent ;
- l'upload et la suppression photo fonctionnent ;
- le responsive mobile est valide sur iPhone ;
- le schema Supabase et la documentation sont a jour.
