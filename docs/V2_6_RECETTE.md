# Recette V2.6 - CRM Dashboard, Maps & Responsive Polish

Cette checklist valide les ameliorations V2.6 sans refaire la recette complete V2.5.

## 1. Page accueil

- Verifier que la section des biens a la une reste masquee si aucun bien n'est mis en avant.
- Avec 1 bien a la une : la carte est centree et premium.
- Avec 2 biens a la une : 2 colonnes desktop, 1 colonne mobile.
- Avec 3 biens a la une : 3 colonnes desktop, 2 tablette, 1 mobile.
- Avec 4 a 6 biens a la une : grille responsive propre.
- Verifier que les cartes ont une hauteur coherente et que les CTA restent alignes.

## 2. Cartes Google Maps

- Sur `/contact`, la carte Google Maps s'affiche sous la carte d'information agence.
- Le lien "Ouvrir dans Google Maps" ouvre bien Google Maps.
- L'adresse officielle de l'agence reste visible : 4 chemin des Bancaous, 83210 Sollies-Pont.
- Sur une fiche `/biens/[slug]`, la carte affiche une localisation indicative par ville et code postal.
- Aucune adresse privee de bien ne doit etre affichee publiquement.

## 3. CRM admin

- Ouvrir `/admin`.
- Verifier que le layout utilise mieux la largeur de l'ecran.
- Verifier que les onglets ne sont pas coupes, notamment "Vue d'ensemble".
- Sur mobile, faire defiler horizontalement les onglets si necessaire.
- Confirmer que la protection par code local fonctionne toujours.

## 4. Vue d'ensemble CRM

- Verifier la presence du dashboard bento.
- Controler les blocs : pipeline commercial, portefeuille de biens, actions rapides, dernieres demandes, activite recente, performance du site, origine des demandes, points a traiter.
- Les blocs GA4 doivent afficher un etat "A connecter" et ne jamais inventer de trafic.
- Les boutons d'actions rapides doivent changer d'onglet correctement.

## 5. Statistiques

- Ouvrir l'onglet `Statistiques`.
- Verifier les sections leads, biens, villes, formulaires, activites et site internet.
- Les moyennes doivent rester lisibles meme si certaines donnees sont manquantes.
- Les mini barres doivent rester visibles sur mobile.
- Les statistiques site internet doivent rester en attente GA4.

## 6. Activites

- Ouvrir l'onglet `Activites`.
- Tester la recherche par action, type, utilisateur ou date.
- Tester les filtres : type d'entite, action, periode.
- Verifier le compteur de resultats.
- Verifier l'etat vide : "Aucune activite ne correspond a votre recherche."

## 7. Responsive mobile

- Tester sur une largeur proche iPhone.
- Verifier que les onglets CRM sont utilisables au doigt.
- Verifier que les cartes bento passent en une colonne.
- Verifier que les champs conservent une taille lisible.
- Verifier qu'aucun texte important n'est coupe.
- Verifier que les cartes Google Maps gardent une hauteur confortable.

## 8. Routes a verifier

- `/`
- `/contact`
- `/estimation`
- `/a-vendre`
- `/biens`
- `/biens/[slug]`
- `/admin`

## 9. Commandes de validation

```bash
npm run lint
npm run build
```

## 10. Points de vigilance

- GA4 n'est pas connecte en V2.6.
- Google Maps utilise uniquement des embeds iframe sans cle API.
- Les fiches biens ne doivent pas exposer d'adresse privee.
- L'authentification admin complete reste un objectif V3.
