# Revue avant invitation des proches — 20 septembre 2026

## Verdict

Bonne base pour une préversion technique ; pas encore prête pour une invitation générale en promettant catalogue, sauvegarde fiable et soirées accessibles par simple code. Le partage public doit être corrigé avant utilisation. Le mobile a besoin d'une passe ciblée. La configuration Netlify couvre le catalogue et les fonctions de stockage, pas le serveur de soirée.

Revue de l'état local au commit `4c410f3`, sans modification du code de l'application. Les captures et ce rapport sont les seuls ajouts. Aucune publication effectuée.

## Vérifications réalisées et limites

- `npm test` : 239 tests réussis, zéro échec.
- `npm run build` : construction de `dist` réussie, 42 fichiers annoncés ; configuration locale contenant le jeton exclue.
- Application construite servie par `tools/serve-dist.mjs`, avec relais TMDB fonctionnel.
- Chrome automatisé : ordinateur 1440 × 1000, fenêtres mobiles 320 et 390 × 844, tablette 768 × 844. Catalogue, filtres, fiche avec bande-annonce, profil, panneau soirée et liste vide visités.
- Aucun débordement horizontal de la page observé aux trois petites largeurs. Aucun `pageerror` pendant les parcours complémentaires soirée/liste.
- Réécriture d'une liste publique reproduite en invoquant la fonction serveur avec une nouvelle fixture locale. Fixture supprimée après vérification ; aucune liste existante touchée.
- Ce ne sont pas des essais sur iPhone/Safari ou Android physique. Lecture audio réelle, rotation, clavier virtuel, débit mobile, Lighthouse, lecteur d'écran, partie complète multi-téléphones et stockage réel Netlify restent à vérifier. Les tests unitaires ne valident pas ces parcours.

## Points positifs

Le catalogue paginé, les collections, la liste personnelle, son export/import et le profil synchronisé forment maintenant un produit cohérent. La clé TMDB est relayée côté serveur pour la version publiée. Les affiches occupent une place convaincante ; le catalogue mobile conserve deux colonnes sans déborder. Les explications de liste vide sont utiles. Les soirées ont déjà un parcours créer/rejoindre et un principe compréhensible de duels.

## Problèmes prioritaires

### Élevée — Le lien public autorise aussi la réécriture

**Localisation :** `netlify/functions/liste.mjs:24–56`.

Le GET et le POST utilisent le même code public, sans preuve de propriété supplémentaire. Deux POST successifs avec ce seul code renvoient 200 et le second remplace la liste publiée. Cela ne donne pas directement accès au profil privé, mais permet à un destinataire de falsifier la liste visible de son propriétaire. L'interface et les commentaires promettent une lecture seule.

**À faire avant partage :** séparer la permission de lecture de celle de publication, contrôler cette dernière côté serveur et construire côté serveur la liste blanche de champs publics. Tester qu'un lecteur ne peut ni remplacer ni supprimer la liste.

### Élevée — Les soirées ne sont pas déployées par Netlify

**Localisation :** `netlify.toml`, `room/server.mjs`, `prototypes/emoji-card/soiree.js:55–64, 224–232`.

Le serveur Node de soirée fournit ses propres routes et son flux EventSource. Il n'est pas démarré par le déploiement statique et les fonctions configurées. Sur un domaine public, le client prend l'origine du site par défaut, où ces routes n'existent pas. Le réglage manuel d'un serveur et l'instruction `npm run room` restent nécessaires dans le parcours actuel.

**À faire :** fournir un serveur de soirée durable, joignable en HTTPS et configuré automatiquement, puis tester une partie avec plusieurs téléphones. Sinon, annoncer clairement que cette première bêta porte sur le catalogue et retirer la promesse de soirée immédiatement disponible. L'hébergement HTTPS du site seul ne rend pas le serveur local accessible aux invités.

### Élevée — Conflit possible entre deux synchronisations

**Localisation :** `prototypes/emoji-card/profil.js:93–106`, `netlify/functions/profil.mjs`, `netlify/lib/rangement.mjs`.

Le client lit le document, fusionne, puis le remplace côté serveur. Deux appareils peuvent lire la même ancienne version et publier deux fusions différentes ; la dernière écriture remplace la précédente. C'est un risque établi par la séquence du code, pas une perte observée sur une base de production. Une copie locale peut permettre une récupération ultérieure ; la sauvegarde distante ne garantit pas la conservation de chaque modification concurrente.

**À faire :** révisions et écriture conditionnelle avec nouvelle fusion en cas de conflit, ou stockage transactionnel adapté. Ajouter un test avec deux clients intercalant leurs lectures/écritures. La cohérence forte de Blobs n'est pas une fusion atomique : sa documentation décrit une résolution par dernière écriture. [Documentation Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).

### Élevée — Les commandes vidéo recouvrent le titre sur mobile

**Localisation :** fiche Explorer, `prototypes/emoji-card/card.js`, `card.css`, `catalogue.css` ; preuve : [detail.png](detail.png).

À 390 × 844, le panneau pause/avance/vitesse/son/affiche déborde sur le titre du film. Le haut de page et les états fixés en bas réduisent aussi fortement la place du synopsis. L'ajout récent des commandes n'est pas suffisamment intégré au petit écran.

**À faire :** réserver la hauteur réelle des commandes dans le flux, regrouper les commandes secondaires et laisser titre/synopsis défiler. Vérifier longues traductions, bande-annonce absente, mode affiche, rotation et zoom texte.

### Moyenne — Navigation mobile trop dense

**Localisation :** en-tête et barre catalogue, `direction.css` et `catalogue.css` ; preuves : [390 px](mobile-390.png), [320 px](mobile-320.png).

Les cinq accès restent répartis dans une seule petite ligne ; la marque se réduit à un cadre peu reconnaissable. Le libellé du choix de taille d'affiche est tronqué. L'absence de débordement horizontal ne suffit pas à rendre l'ensemble confortable au doigt.

**À faire :** trois destinations stables et clairement lisibles (Explorer, Ma liste, Soirée), profil secondaire, recherche facile à atteindre et filtres dans un panneau mobile. Prévoir des zones tactiles confortables, vérifier les noms accessibles et les états de sélection.

### Moyenne — « Arrêter le partage » laisse le lien fonctionner

**Localisation :** `prototypes/emoji-card/profil.js:390–396`.

L'action efface seulement le code mémorisé sur l'appareil. Le document publié reste côté serveur. Une explication le reconnaît, mais le libellé suggère une révocation réelle.

**À faire :** véritable révocation côté serveur avec permission propriétaire, ou libellé strictement descriptif en attendant. Vérifier l'ancien lien après révocation.

### Moyenne — Fermeture du profil au clavier

**Localisation :** `prototypes/emoji-card/profil.js`.

Dans le parcours Chrome, Échap n'a pas fermé le profil ; l'automatisation a ensuite été bloquée par ce panneau. Le bouton fermer reste disponible. Cela ne prouve pas à lui seul une absence de toute gestion du focus.

**À faire :** harmoniser Échap, placement initial et restitution du focus entre les panneaux, puis contrôler la navigation clavier complète.

### Faible — Présentation encore marquée « prototype »

**Localisation :** `prototypes/emoji-card/index.html:7–8`, README, commentaires de `netlify.toml`.

Le titre reste « FRAME — carte-film », la description parle de prototype emoji, et une partie de la documentation ne reflète plus les profils et le stockage distant. Un lien envoyé à un proche doit expliquer immédiatement l'utilité du produit.

**À faire :** nom cohérent, description claire, aperçu de partage, favicon lisible, documentation alignée sur les fonctions effectivement disponibles.

## Direction artistique et thèmes

**Verdict esthétique :** pas de besoin de repartir de zéro. L'interface a déjà une sobriété cinéma utile. Elle reste cependant très uniforme : fond sombre, nombreuses petites commandes, identité reposant surtout sur les affiches. Le profil réintroduit des avatars emoji très colorés. L'accumulation de contrôles donne plus une impression d'outil en construction que de rendez-vous cinéma chaleureux. Ce constat est une appréciation de design, distincte des bugs reproduits. Aucun sélecteur de thèmes visuels n'a été identifié.

Un thème devrait changer palette, typographie, traitement des affiches et détails de mouvement tout en conservant les repères fonctionnels et l'accessibilité. Trois pistes suffisamment distinctes :

| Piste | Identité | Application |
| --- | --- | --- |
| Ciné-club | Papier crème, bordeaux, charbon ; titres sérif expressifs, détails de billets de cinéma | Accueil chaleureux et éditorial, affiches encadrées, listes agréables à lire de jour |
| Minuit | Encre, ivoire, ambre ; sans sérif nette, grands visuels, espaces généreux | Immersion dans les bandes-annonces, commandes discrètes mais lisibles, transitions courtes |
| Pop | Cobalt, mandarine, blanc cassé ; typographie ronde et épaisse, géométrie franche | Énergie des soirées et votes, animations brèves de résultat ; éviter les clignotements et l'agitation permanente |

Choix individuel conservé sur chaque appareil, valeur par défaut soignée et respect de la réduction des animations. Concevoir chaque thème d'abord sur téléphone. Des variations de couleur seules ne répondraient pas à la demande de directions fortes.

Pour le nom, préférence créative : **Bobine**, chaleureux, court et lié au cinéma. Alternatives : **On mate ?**, plus conversationnel, ou **Plan Canapé**, qui exprime le rendez-vous collectif. Disponibilité des noms, marques et domaines non vérifiée ; aucune décision de renommage appliquée.

## Publication Netlify, pas à pas

Le dépôt a déjà un remote GitHub `MattJeanLouis/frame` et un `netlify.toml`. Il reste à vérifier que les corrections et la version souhaitée sont poussées avant déploiement.

1. Créer le compte Netlify, puis **Add new project → Import an existing project → GitHub** et sélectionner ce dépôt. [Guide officiel](https://docs.netlify.com/start/quickstarts/deploy-from-repository/).
2. Conserver la racine du dépôt ; construction `node tools/build-netlify.mjs`, dossier publié `dist`, fonctions `netlify/functions`. Ces valeurs figurent déjà dans `netlify.toml`.
3. Ajouter `TMDB_TOKEN` dans les variables d'environnement Netlify, avec disponibilité pour les fonctions. Ne jamais mettre le jeton dans le dépôt. Redéployer après modification des variables pour les fonctions. [Variables des fonctions](https://docs.netlify.com/build/functions/environment-variables/).
4. Lancer une première préversion et vérifier le catalogue réel, l'absence du jeton dans les fichiers servis, la sauvegarde/relecture du profil et la publication/révocation de la liste une fois corrigée. Le serveur de test local utilise des fichiers : son succès ne valide pas l'intégration Netlify Blobs.
5. Ouvrir l'URL sur Safari iPhone et Chrome Android, puis sur deux appareils à la fois. Le stockage local du site de développement ne migre pas automatiquement vers le nouveau domaine : utiliser export/import pour conserver son carnet si nécessaire.
6. Vérifier l'accès hors du compte Netlify avant d'envoyer le lien : les nouvelles équipes peuvent avoir les projets privés par défaut. [Guide officiel](https://docs.netlify.com/start/quickstarts/deploy-from-repository/).
7. Inviter d'abord deux ou trois proches et observer : trouver un film correspondant à une envie, comprendre où le regarder, le conserver, retrouver sa liste. Pour les soirées, ajouter création, invitation par code et résultat de vote après déploiement du serveur adapté.

Le plan Free constitue un point de départ possible pour cette bêta : il comprend actuellement 300 crédits mensuels et une limite dure, donc il faut surveiller l'usage. Cela ne garantit pas un hébergement gratuit sans limite. [Tarifs officiels](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/).

## Ordre recommandé

1. Sécuriser le partage et sa révocation ; résoudre les conflits de synchronisation.
2. Corriger la fiche vidéo et la navigation mobile.
3. Choisir le nom et prototyper les trois thèmes sur catalogue, fiche et soirée.
4. Déployer une préversion Netlify, valider le stockage réel et les appareils physiques.
5. Rendre le serveur de soirée accessible sans manipulation technique avant de promettre ce parcours aux invités.
6. Faire une courte bêta avec des proches avant l'invitation générale.

Captures supplémentaires : [ordinateur](desktop.png), [tablette](mobile-768.png), [filtres](filters.png), [profil](btn-profil.png), [soirée](btn-soiree.png), [liste vide](btn-liste.png).
