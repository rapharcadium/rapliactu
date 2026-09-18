# Rapli Actu — V2.1.6

## Suppression complète des miniatures
- Les miniatures sont retirées de toutes les cartes du feed et de l’historique.
- Le collecteur ne stocke plus d’URL d’image.
- L’enrichisseur ne recherche plus d’image dans les articles.
- `/api/feed` et `/api/history` suppriment aussi les anciens champs image déjà présents dans Netlify Blobs.
- Les icônes du site, le favicon et le logo du singe restent inchangés.
- L’enrichissement conserve uniquement ce qui reste utile : disponibilité, médias intégrés et Anti‑Putaclic.

# Rapli Actu — V2.1.5

## V2.1.5 — Miniatures sans placeholders
- bloque les URLs d’images manifestement génériques (`placeholder`, `no-image`, `default-*`, favicon, etc.) ;
- retire les mêmes visuels répétés sur 4 articles ou plus d’une même source, typiques des images de secours ;
- nettoie aussi les anciennes miniatures déjà stockées au moment où `/api/feed` et `/api/history` répondent ;
- contrôle côté navigateur les images trop petites ou aux proportions aberrantes ;
- si aucune vraie image n’est disponible, la carte reste simplement sans miniature.


Correctif critique : restauration du feed `/api/feed`, logo header transparent et fortement réduit, cache navigateur rendu compatible avec les mises à jour quotidiennes, fallback local si l’API est momentanément indisponible.

# Rapli Actu — V2.1.3

## Correctif caractères HTML

- Décodage global des entités HTML dans les titres et résumés (`&#039;`, `&amp;`, `&quot;`, `&nbsp;`, entités numériques décimales/hexadécimales, etc.).
- Gestion des entités doublement encodées (`&amp;#039;`).
- Normalisation appliquée à la collecte **et** aux réponses `/api/feed` et `/api/history`, donc les anciens articles déjà stockés sont corrigés à l'affichage sans attendre leur expiration.

# Rapli Actu — Netlify V2

Portage Netlify du Design Lab validé, avec collecte serveur, historique 30 jours, miniatures et enrichissement des articles.

## Architecture

- `collect` : toutes les 10 minutes. Récupère les sources en parallèle, avec une profondeur adaptée (20 à 100 éléments selon la source).
- **Affichage courant** : seulement les 10 dernières actus par source sont conservées dans `feed/current` pour un chargement rapide.
- **Historique** : toutes les nouvelles actus détectées sont archivées dans Netlify Blobs pendant 30 jours, même si tu ne visites pas le site.
- `enrich` : à 03, 13, 23, 33, 43 et 53 minutes de chaque heure. Enrichit jusqu’à 36 articles par passage avec disponibilité (libre/compte/abonnement) et détection de média intégré (X, YouTube, Instagram, Facebook, TikTok, vidéo native).
- `/api/feed` : renvoie le feed courant + le nombre d’actus nouvelles depuis la dernière visite.
- `/api/history` : charge les actualités précédentes par pages de 100 jusqu’à 30 jours.

## Sources

26 sources actives déclarées.

Les règles spéciales sont déjà incluses :

- RTL Les Grosses Têtes : uniquement les articles dont le titre contient « Le planning des Grosses Têtes ».
- Tendance Ouest : uniquement les articles contenant « Le Havre » ou « au Havre ».

## Mise à jour du projet Netlify existant

1. Sauvegarde ton dépôt actuel si tu veux pouvoir revenir en arrière.
2. Remplace le contenu du dépôt GitHub par **le contenu de ce dossier** (pas le dossier parent lui-même).
3. Vérifie qu’à la racine du repo tu as :

```text
netlify.toml
package.json
public/
netlify/
```

4. Commit + push vers GitHub.
5. Attends la fin du déploiement Netlify.
6. Dans Netlify : **Cloud compute → Functions → collect → Run now**.
7. Une fois `collect` terminé, lance aussi **enrich → Run now** une fois pour amorcer les miniatures et indicateurs.
8. Recharge le site.

Les fonctions planifiées prendront ensuite le relais automatiquement sur le déploiement publié.

## Ce qui change par rapport à la V1

- Design Rapli Actu (Poppins, fond noir/anthracite/bleu nuit + menthe légère + texture).
- Menu déroulant de thèmes, pas de barre de recherche.
- Aucun favori et aucun tri « récent/source/putaclic ».
- Cartes teintées par catégorie.
- - Point de disponibilité : vert libre, orange compte, rouge abonnement, gris inconnu.
- Indicateurs média : X, YouTube, Instagram, Facebook, TikTok, vidéo.
- Message « X nouvelles actus » basé sur les articles réellement découverts depuis la dernière validation.
- Historique 30 jours avec bouton « Charger les actualités précédentes ».
- La limite de 10 ne concerne plus la collecte : elle concerne uniquement le feed courant par source.

## Logs utiles

`collect` écrit une ligne par source :

```text
{"event":"rapli-source","name":"FFF","status":"ok","count":10,"candidates":32,"newCount":4}
```

Puis un résumé :

```text
{"event":"rapli-collect","ok":true,...}
```

`enrich` écrit un résumé `rapli-enrich` et les erreurs individuelles éventuelles.

## Favicon
Le favicon Rapli Actu est généré à partir du visuel fourni et inclus pour navigateur, iOS et manifeste web.


## V2.0.2
Le favicon singe est également affiché comme petit logo dans le header, sans augmenter sa hauteur.


## V2.0.3
Sources supprimées : Touchdown Actu, Passion MLB, BasketUSA, BeBasket, Radio Metal, Cœurs de Foot, TrashTalk, FFBB et Sakina Karchaoui — Instagram. Les anciennes entrées de ces sources sont aussi filtrées de l’historique et du compteur de nouvelles actus.


## V2.1 — Anti‑Putaclic V2
- Analyse en 2 passes : titre/résumé puis corps de l’article lors de `enrich`.
- Détecte personnes masquées (`ce joueur`, `cette star`), informations cachées (`ce qui`, `la raison`, `voici pourquoi`) et accroches sensationnalistes.
- Cherche dans le texte une information concrète (`manque de maîtrise`, `problème de concentration`, etc.) avant toute réécriture précise.
- Si aucune réponse suffisamment fiable n’est trouvée, neutralise le titre sans inventer de détail.
- Le titre original reste accessible en petit avec le badge `🎣 nettoyé`.
- Le corps intégral de l’article n’est jamais stocké : il ne sert que temporairement à l’analyse pendant l’enrichissement.


## V2.1.1 — Nettoyage des sources
- Le Marin est désormais classé dans **Transport**.
- Sources supprimées : Foot Mercato, CardsAddict, Cyclism’Actu et SportCard.
- Passion MLB et TrashTalk restent supprimées.
- Le endpoint `/api/feed` filtre désormais aussi le cache courant avec la liste des sources actives : une source retirée ne peut plus rester visible après un déploiement en attendant le prochain `collect`.
- La file `enrich` ignore également les anciennes entrées provenant de sources retirées.



## V2.1.2 — Chroniques Bleues + Footy Headlines
- Correction de **Chroniques Bleues (#15)** : l’extracteur ne scanne plus tous les liens internes. Il ne conserve que les vrais titres d’articles de la page d’accueil (`h2`) accompagnés d’une date de publication explicite.
- Les anciennes entrées Chroniques Bleues avec date artificiellement inférée sont filtrées du feed et de l’historique visible.
- Après une collecte Chroniques Bleues réussie, le feed courant de cette source est remplacé par la nouvelle liste propre afin d’éliminer immédiatement les anciennes pages parasites en cache.
- **Footy Headlines (#16) supprimé** de Rapli Actu. Les anciennes entrées Footy Headlines sont automatiquement masquées du feed, de l’historique et de la file d’enrichissement.
- Total : **26 sources actives**.

## V2.1.7 — correctif Le Marin

- Le Marin utilise désormais un extracteur dédié au lieu du parseur HTML générique.
- seules les vraies pages d’articles avec une date de publication explicite sont acceptées ;
- les pages de rubrique/navigation et les liens sans date ne peuvent plus être artificiellement propulsés en haut du feed ;
- tri strict par date publiée ;
- `replaceCurrentOnSuccess` reconstruit les 10 entrées Le Marin à partir du relevé propre ;
- les anciennes entrées Le Marin dont la date avait été inférée sont filtrées du feed/historique.

Après déploiement, lancer `collect` une fois avec **Run now** pour reconstruire immédiatement la source Le Marin.

## V2.1.8 — Le Marin + suppression définitive des miniatures
- Le Marin : la home sert uniquement à découvrir des candidats ; Rapli Actu ouvre ensuite les pages candidates côté serveur, lit leur date de publication réelle et n'affiche que les articles accessibles et réellement datés. Aucun ordre artificiel n'est accepté.
- Miniatures : nouveaux noms de fichiers CSS/JS pour casser tout ancien cache navigateur, nouveau cache local, masquage CSS de toute image éventuelle dans une carte, et suppression des champs image côté API.
