# Ambiances — 20 septembre 2026

Direction contemporaine après retour utilisateur. Le nom adopté est **What the Flick (WTF)**. Identité et aperçus mis à jour dans [la planche de marque](../brand/identity.html). Les captures de cette revue des thèmes précèdent le renommage.

| Ambiance | Direction | Ordinateur | Téléphone |
| --- | --- | --- | --- |
| Première, par défaut | Graphite, rouge, affiches au premier plan | [Voir](premiere-desktop.png) | [Voir](premiere-mobile.png) |
| Studio | Blanc minéral, grille éditoriale nette | [Voir](studio-desktop.png) | [Voir](studio-mobile.png) |
| After Hours | Prune, rose, navigation en capsule et arrondis doux | [Voir](afterhours-desktop.png) | [Voir](afterhours-mobile.png) |
| Signal | Bleu franc, grands titres, angles nets | [Voir](signal-desktop.png) | [Voir](signal-mobile.png) |
| Horizon | Pierre, olive, compositions aérées | [Voir](horizon-desktop.png) | [Voir](horizon-mobile.png) |

Le bouton Ambiances se trouve à côté du titre du catalogue. Le choix est immédiat et mémorisé dans `frame.appearance.v1`, sans toucher aux profils ou aux listes. Les choix de la première proposition sont migrés. Si le stockage est bloqué, le choix fonctionne pour la visite et un message le précise.

Implémentation : `prototypes/emoji-card/themes.css`, `themes.js`, ajout dans `index.html` et vérification des fichiers au build. Les commandes sur vidéo gardent leur contraste propre. Le titre de fiche mobile ne chevauche plus le lecteur.

Validation : 239 tests unitaires réussis ; construction Netlify réussie ; Chrome automatisé sur les cinq thèmes à 320, 390, 768 et 1440 px, sans débordement horizontal. Contrôles de sélection unique, Échap, restitution du focus, persistance après rechargement, stockage indisponible et absence de chevauchement titre/lecteur réussis. Aucun `pageerror` pendant ce parcours. Safari/iPhone physique non testé.

[Choix des ambiances](selector-mobile.png) · [Fiche mobile](detail-mobile.png) · [Filtres](filters-mobile.png) · [Profil](profile-mobile.png)
