# MON FEED — V1 Netlify Native

Cette version abandonne les proxys CORS côté navigateur. Le navigateur ne contacte plus les médias : il lit **un seul feed JSON déjà préparé**.

## Architecture

```text
24 sources
   │
   ├─ RSS officiel quand disponible
   ├─ extracteur HTML dédié (FFF, Footy Headlines)
   └─ extracteur HTML générique pour certaines pages
   │
   ▼
Netlify Scheduled Function `collect`
(toutes les 10 minutes)
   │
   ├─ 10 actus max/source
   ├─ dédoublonnage
   ├─ normalisation des dates/liens
   ├─ anti-putaclic léger
   └─ si une source tombe : conservation de son dernier cache valide
   │
   ▼
Netlify Blobs `mon-feed`
(une seule écriture atomique par cycle)
   │
   ▼
Edge Function `/api/feed`
   │
   ▼
Interface web
```

## Pourquoi cette architecture est plus fiable

- Aucun CORS dans le navigateur.
- Aucun proxy public AllOrigins/corsproxy.io.
- Aucun Google News utilisé comme source de secours.
- Une source en panne n'efface plus ses anciennes actus : elle passe en état `stale`.
- Le cache complet est écrit en une seule fois : le lecteur ne voit jamais un feed à moitié mis à jour.
- Les 24 sources sont collectées côté serveur en parallèle.
- Le site ne charge qu'un JSON, donc l'ouverture est très rapide.
- Les éventuelles clés futures restent dans les variables d'environnement Netlify et jamais dans le HTML.

## Déploiement recommandé sur Netlify

### Option A — GitHub + Netlify (recommandée)

1. Décompresse ce projet et place-le dans un dépôt GitHub.
2. Dans Netlify : **Add new project > Import an existing project**.
3. Sélectionne le dépôt.
4. Netlify détecte `netlify.toml`. Il n'y a pas de framework ni de commande de build à renseigner.
5. Déploie en production.
6. Après le premier déploiement, ouvre **Netlify > Functions > collect > Run now** une fois.
7. Ouvre ton site : `/api/feed` doit maintenant contenir les données et la page d'accueil les affiche.

Ensuite, `collect` se relance automatiquement toutes les 10 minutes.

### Option B — Netlify CLI

```bash
npm install
npx netlify login
npx netlify init
npx netlify deploy --prod
```

Puis lance une première collecte depuis l'interface Netlify (`Functions > collect > Run now`).

## Développement local

```bash
npm install
npm run dev
```

Attention : Netlify Dev ne lance pas le cron automatiquement. Pour tester la collecte :

```bash
npx netlify functions:invoke collect
```

## États d'une source

- `ok` : récupération réussie au dernier cycle.
- `stale` : la récupération actuelle a échoué, mais le dernier cache valide est conservé.
- `error` : aucune récupération n'a encore réussi.
- `disabled` : source volontairement non connectée (actuellement Instagram).

## Instagram

La source Sakina Karchaoui est déclarée mais désactivée. Instagram ne fournit pas de RSS public fiable pour un compte tiers. On pourra ensuite connecter une API/service autorisé sans modifier l'architecture générale.

## Ajouter une source

Tout se fait dans `netlify/lib/sources.mjs`.

### RSS

```js
{ id:'exemple', name:'Exemple', domain:'exemple.fr', category:'football', icon:'⚽', color:'#123456', rss:['https://exemple.fr/feed/'] }
```

### Page HTML

```js
{
  id:'exemple', name:'Exemple', domain:'exemple.fr', category:'football',
  icon:'⚽', color:'#123456', adapter:'genericHtml',
  page:'https://exemple.fr/actus',
  linkPattern:/^https?:\/\/(?:www\.)?exemple\.fr\/actus\//i
}
```

Si un site a une structure spéciale, on lui crée un parseur dédié dans `netlify/lib/parsers.mjs`, comme pour FFF et Footy Headlines.

## Limite actuelle assumée

Le collecteur reste volontairement à **10 actus/source**. C'est le meilleur compromis pour ton feed perso : léger, rapide et suffisamment fourni.

Le moteur anti-putaclic travaille encore sur `titre + extrait`. Une future V1.1 pourra enrichir uniquement les titres vagues en allant lire le corps de l'article côté serveur, sans ralentir la collecte principale.
