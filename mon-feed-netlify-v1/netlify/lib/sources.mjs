export const MAX_PER_SOURCE = 10;

// Priorité : RSS officiel > page directe > cache précédent.
// Pas de Google News en secours : mieux vaut une source "stale" qu'une remontée incorrecte.
export const SOURCES = [
  { id:'bebasket', name:'BeBasket', domain:'bebasket.fr', category:'basket', icon:'🏀', color:'#e64b3c', rss:['https://www.bebasket.fr/feed/'] },
  { id:'sofoot', name:'So Foot', domain:'sofoot.com', category:'football', icon:'⚽', color:'#e84558', rss:['https://www.sofoot.com/rss'] },
  { id:'fff', name:'FFF', domain:'fff.fr', category:'football', icon:'🇫🇷', color:'#2d76d2', adapter:'fff', page:'https://www.fff.fr/voir_plus/dernieres_actualites.html' },
  { id:'touchdown', name:'Touchdown Actu', domain:'touchdownactu.com', category:'nfl', icon:'🏈', color:'#de3038', rss:['https://touchdownactu.com/feed/'] },
  { id:'basketusa', name:'BasketUSA', domain:'basketusa.com', category:'basket', icon:'🏀', color:'#f28b24', rss:['https://www.basketusa.com/feed/'] },
  { id:'footmercato', name:'Foot Mercato', domain:'footmercato.net', category:'football', icon:'⚽', color:'#1686d9', rss:['https://www.footmercato.net/flux-rss'] },
  { id:'doyens', name:'Doyens', domain:'doyens.fr', category:'football', icon:'🔵', color:'#7aa8d8', rss:['https://doyens.fr/feed/'], page:'https://doyens.fr/', linkPattern:/^https?:\/\/(?:www\.)?doyens\.fr\/(?!wp-|feed|category|tag|author)/i },
  { id:'hac', name:'HAC', domain:'hac.football', category:'football', icon:'💙', color:'#6faee8', adapter:'genericHtml', page:'https://hac.football/fr/posts', linkPattern:/^https?:\/\/(?:www\.)?hac\.football\/fr\/posts\//i },

  { id:'passionmlb', name:'Passion MLB', domain:'passionmlb.com', category:'baseball', icon:'⚾', color:'#d92d2d', rss:['https://passionmlb.com/categorie/actualite/feed/'] },
  { id:'trashtalk', name:'TrashTalk', domain:'trashtalk.co', category:'basket', icon:'🏀', color:'#f03b24', rss:['https://trashtalk.co/category/news-nba/feed/'] },
  { id:'76actu', name:'76actu', domain:'actu.fr', category:'local', icon:'📍', color:'#e51f2a', rss:['https://actu.fr/76actu/rss.xml'] },
  { id:'journalpl', name:'Journal du Poids Lourd', domain:'journaldupoidslourd.com', category:'transport', icon:'🚛', color:'#d65a31', rss:['https://journaldupoidslourd.com/feed/'] },
  { id:'metalzone', name:'MetalZone', domain:'metalzone.fr', category:'metal', icon:'🤘', color:'#b23a3a', rss:['https://www.metalzone.fr/feed/'] },
  { id:'metalorgie', name:'Metalorgie', domain:'metalorgie.com', category:'metal', icon:'🤘', color:'#8e8e8e', rss:['https://www.metalorgie.com/feed/news'] },
  { id:'lequipefoot', name:"L'Équipe Football", domain:'lequipe.fr', category:'football', icon:'📰', color:'#d8ff00', rss:['https://www.lequipe.fr/rss/actu_rss_Football.xml'] },
  { id:'chroniquesbleues', name:'Chroniques Bleues', domain:'chroniquesbleues.fr', category:'football', icon:'🇫🇷', color:'#315ca8', adapter:'genericHtml', page:'https://www.chroniquesbleues.fr/', linkPattern:/^https?:\/\/(?:www\.)?chroniquesbleues\.fr\/(?!spip|IMG|local|ecrire|$)/i },
  { id:'footyheadlines', name:'Footy Headlines', domain:'footyheadlines.com', category:'football', icon:'👕', color:'#f0c02d', adapter:'footy', page:'https://www.footyheadlines.com/' },
  { id:'ffbb', name:'FFBB', domain:'ffbb.com', category:'basket', icon:'🇫🇷', color:'#245bb3', adapter:'genericHtml', page:'https://www.ffbb.com/actualites', linkPattern:/^https?:\/\/(?:www\.)?ffbb\.com\/actualites\//i },
  { id:'cardsaddict', name:'CardsAddict', domain:'cardsaddict.goodbarber.app', category:'cards', icon:'🃏', color:'#7c5ce7', adapter:'genericHtml', page:'https://cardsaddict.goodbarber.app/newscards/c/0', linkPattern:/^https?:\/\/cardsaddict\.goodbarber\.app\/newscards\/i/ },
  { id:'ligue1', name:'Ligue 1', domain:'ligue1.com', category:'football', icon:'🇫🇷', color:'#d7ff28', adapter:'genericHtml', page:'https://ligue1.com/fr/articles', linkPattern:/^https?:\/\/(?:www\.)?ligue1\.com\/fr\/articles\//i },
  { id:'coeursdefoot', name:'Cœurs de Foot', domain:'coeursdefoot.fr', category:'football', icon:'⚽', color:'#d9497a', rss:['https://coeursdefoot.fr/feed/'], page:'https://coeursdefoot.fr/' },
  { id:'footeuses', name:'Footeuses', domain:'footeuses.com', category:'football', icon:'⚽', color:'#ef668d', rss:['https://footeuses.com/feed/'], page:'https://footeuses.com/' },
  { id:'radiometal', name:'Radio Metal — News Express', domain:'radiometal.com', category:'metal', icon:'🤘', color:'#df3535', rss:['https://www.radiometal.com/category/news-express/feed/'], page:'https://www.radiometal.com/category/news-express' },

  // Instagram ne fournit pas de flux public fiable pour un compte tiers.
  // On le garde déclaré pour l'interface et on branchera un fournisseur/API plus tard si souhaité.
  { id:'sakinaig', name:'Sakina Karchaoui — Instagram', domain:'instagram.com', category:'football', icon:'📸', color:'#d946ef', disabled:true, disabledReason:'Instagram : connecteur/API tiers requis', page:'https://www.instagram.com/sakinakarchaoui/?hl=fr' }
];

export const CATEGORY_LABELS = {
  all:'Tout', football:'Foot', basket:'Basket', nfl:'NFL', baseball:'MLB', local:'Local', transport:'Transport', metal:'Metal', cards:'Cards'
};
