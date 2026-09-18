export const CURRENT_PER_SOURCE = 10;
export const HISTORY_DAYS = 30;
export const RECENT_MAX = 400;

export const SOURCES = [
  { id:'sofoot', name:'So Foot', domain:'sofoot.com', category:'football', icon:'⚽', color:'#e84558', collectDepth:40, rss:['https://www.sofoot.com/rss'] },
  { id:'fff', name:'FFF', domain:'fff.fr', category:'football', icon:'🇫🇷', color:'#2d76d2', collectDepth:40, adapter:'fff', page:'https://www.fff.fr/voir_plus/dernieres_actualites.html', readerFallback:true, linkPattern:/https?:\/\/(?:www\.)?fff\.fr\/article\/\d+-[^\s)]+\.html/i },
  { id:'doyens', name:'Doyens', domain:'doyens.fr', category:'football', icon:'🔵', color:'#7aa8d8', collectDepth:25, rss:['https://doyens.fr/feed/'], page:'https://doyens.fr/', linkPattern:/^https?:\/\/(?:www\.)?doyens\.fr\/(?!wp-|feed|category|tag|author)/i },
  { id:'hac', name:'HAC', domain:'hac.football', category:'football', icon:'💙', color:'#6faee8', collectDepth:25, adapter:'genericHtml', page:'https://hac.football/fr/posts', linkPattern:/^https?:\/\/(?:www\.)?hac\.football\/fr\/posts\//i },

  { id:'76actu', name:'76actu', domain:'actu.fr', category:'local', icon:'📍', color:'#e51f2a', collectDepth:50, rss:['https://actu.fr/76actu/rss.xml'] },
  { id:'journalpl', name:'Journal du Poids Lourd', domain:'journaldupoidslourd.com', category:'transport', icon:'🚛', color:'#d65a31', collectDepth:40, rss:['https://journaldupoidslourd.com/feed/'] },
  { id:'metalzone', name:'MetalZone', domain:'metalzone.fr', category:'metal', icon:'🤘', color:'#b23a3a', collectDepth:35, rss:['https://www.metalzone.fr/feed/'] },
  { id:'metalorgie', name:'Metalorgie', domain:'metalorgie.com', category:'metal', icon:'🤘', color:'#8e8e8e', collectDepth:50, rss:['https://www.metalorgie.com/feed/news'] },
  { id:'lequipefoot', name:"L'Équipe Football", domain:'lequipe.fr', category:'football', icon:'📰', color:'#d8ff00', collectDepth:60, rss:['https://www.lequipe.fr/rss/actu_rss_Football.xml','http://www.lequipe.fr/rss/actu_rss_Football.xml'], rss2jsonFallback:true, availabilityDefault:'mixed' },
  { id:'chroniquesbleues', name:'Chroniques Bleues', domain:'chroniquesbleues.fr', category:'football', icon:'🇫🇷', color:'#315ca8', collectDepth:25, adapter:'chroniquesBleues', page:'https://www.chroniquesbleues.fr/', replaceCurrentOnSuccess:true, rejectInferredStored:true },
  { id:'ligue1', name:'Ligue 1', domain:'ligue1.com', category:'football', icon:'🇫🇷', color:'#d7ff28', collectDepth:50, adapter:'sitemap', sitemap:'https://ligue1.com/sitemap.xml', sitemapPattern:/^https?:\/\/(?:www\.)?ligue1\.com\/fr\/articles\//i, page:'https://ligue1.com/fr/articles' },
  { id:'footeuses', name:'Footeuses', domain:'footeuses.com', category:'football', icon:'⚽', color:'#ef668d', collectDepth:35, rss:['https://footeuses.com/feed/'], page:'https://footeuses.com/' },

  { id:'rtlgt', name:'RTL — Les Grosses Têtes', domain:'rtl.fr', category:'entertainment', icon:'🎙️', color:'#f2c94c', collectDepth:20, adapter:'genericHtml', page:'https://www.rtl.fr/programmes/les-grosses-tetes?tab=nav-articles', readerFallback:true, linkPattern:/^https?:\/\/(?:www\.)?rtl\.fr\/culture\/medias-people\/le-planning-des-grosses-tetes-/i, includeTitle:/\ble planning des grosses têtes\b/i },
  { id:'lemarin', name:'Le Marin', domain:'lemarin.ouest-france.fr', category:'transport', icon:'⚓', color:'#4cb7c5', collectDepth:40, adapter:'lemarin', page:'https://lemarin.ouest-france.fr/', readerFallback:false, replaceCurrentOnSuccess:true, rejectInferredStored:true, availabilityDefault:'mixed' },
  { id:'parisnormandie', name:'Paris-Normandie — Le Havre', domain:'paris-normandie.fr', category:'local', icon:'📍', color:'#547aa5', collectDepth:50, adapter:'genericHtml', page:'https://www.paris-normandie.fr/29000/sections/le-havre', readerFallback:true, linkPattern:/^https?:\/\/(?:www\.)?paris-normandie\.fr\/(?!abonnement|connexion|recherche|mentions|$)/i, availabilityDefault:'mixed' },
  { id:'lemonde', name:'Le Monde — En continu', domain:'lemonde.fr', category:'general', icon:'🌍', color:'#8ba3bd', collectDepth:100, rss:['https://www.lemonde.fr/actualite-en-continu/rss_full.xml','https://www.lemonde.fr/rss/une.xml'], availabilityDefault:'mixed' },
  { id:'imoca', name:'IMOCA', domain:'imoca.org', category:'sailing', icon:'⛵', color:'#2cb8b2', collectDepth:60, adapter:'genericHtml', page:'https://www.imoca.org/fr/news/news', linkPattern:/^https?:\/\/(?:www\.)?imoca\.org\/fr\/news\/news\//i },
  { id:'voiles', name:'Voiles et Voiliers', domain:'voilesetvoiliers.ouest-france.fr', category:'sailing', icon:'⛵', color:'#55a9c9', collectDepth:60, adapter:'genericHtml', page:'https://voilesetvoiliers.ouest-france.fr/', readerFallback:true, linkPattern:/^https?:\/\/voilesetvoiliers\.ouest-france\.fr\/(?!abonnement|connexion|mentions|contact|$)/i, availabilityDefault:'mixed' },
  { id:'transportinfo', name:'Transport Info', domain:'transportinfo.fr', category:'transport', icon:'🚛', color:'#d49037', collectDepth:50, rss:['https://www.transportinfo.fr/feed/'] },
  { id:'trm24', name:'TRM24', domain:'trm24.fr', category:'transport', icon:'🚛', color:'#e57339', collectDepth:60, rss:['https://feeds.feedburner.com/trm24/ZnsqJXJiEJx','https://www.trm24.fr/feed/'], page:'https://www.trm24.fr/' },
  { id:'officieltransporteurs', name:"L'Officiel des Transporteurs", domain:'lofficieldestransporteurs.fr', category:'transport', icon:'🚛', color:'#d8a15d', collectDepth:60, adapter:'genericHtml', page:'https://www.lofficieldestransporteurs.fr/actualites/', linkPattern:/^https?:\/\/(?:www\.)?lofficieldestransporteurs\.fr\/actualites\/(?!index_)[^?#]+\.php/i, availabilityDefault:'mixed' },
  { id:'cartesstickers', name:'Cartes & Stickers', domain:'cartesetstickers.fr', category:'cards', icon:'🃏', color:'#c16b9a', collectDepth:50, rss:['https://cartesetstickers.fr/category/actualites/feed/','https://cartesetstickers.fr/feed/'], page:'https://cartesetstickers.fr/category/actualites/' },
  { id:'tendanceouest', name:'Tendance Ouest — Le Havre', domain:'tendanceouest.com', category:'local', icon:'📍', color:'#a16fb2', collectDepth:100, adapter:'genericHtml', page:'https://www.tendanceouest.com/', readerFallback:true, includeText:/\b(?:Le Havre|au Havre)\b/i, linkPattern:/^https?:\/\/(?:www\.)?tendanceouest\.com\/(?!podcast|programme|contact|mentions|$)/i },
  { id:'lehavre', name:'LeHavre.fr', domain:'lehavre.fr', category:'local', icon:'🏙️', color:'#4f8ea8', collectDepth:60, adapter:'genericHtml', page:'https://lehavre.fr/actualites/toutes-les-actualites', linkPattern:/^https?:\/\/(?:www\.)?lehavre\.fr\/actualites\/(?!toutes-les-actualites$)[^?#]+/i },
  { id:'lhsm', name:'Le Havre Seine Métropole', domain:'lehavreseinemetropole.fr', category:'local', icon:'🌊', color:'#4ca9a4', collectDepth:60, adapter:'genericHtml', page:'https://www.lehavreseinemetropole.fr/actualites', linkPattern:/^https?:\/\/(?:www\.)?lehavreseinemetropole\.fr\/actualites\/(?!$)[^?#]+/i },
  { id:'footnational', name:'Foot National — Fil info', domain:'foot-national.com', category:'football', icon:'⚽', color:'#6fb34b', collectDepth:100, adapter:'genericHtml', page:'https://www.foot-national.com/fil-info.html', readerFallback:true, linkPattern:/^https?:\/\/(?:www\.)?foot-national\.com\/(?!fil-info\.html|classement|calendrier|clubs|$)[^?#]+/i },

];

export const ACTIVE_SOURCE_IDS = new Set(SOURCES.map(source => source.id));
export const SOURCE_BY_ID = new Map(SOURCES.map(source => [source.id, source]));

// Filtre aussi les anciennes entrées en cache devenues invalides après un correctif d'extracteur.
export function isStoredArticleAllowed(item) {
  const source = SOURCE_BY_ID.get(item?.sourceId);
  if (!source) return false;
  if (source.rejectInferredStored && item?.dateInferred === true) return false;
  return true;
}

export const CATEGORY_LABELS = {
  all:'Tous les thèmes', football:'Football', basket:'Basket / NBA', nfl:'NFL', baseball:'MLB', local:'Actualité locale',
  transport:'Transport', metal:'Metal', cards:'Cards', maritime:'Maritime', sailing:'Voile', general:'Actualité générale',
  entertainment:'Divertissement', cycling:'Cyclisme'
};

export const CATEGORY_ICONS = {
  football:'⚽', basket:'🏀', nfl:'🏈', baseball:'⚾', local:'📍', transport:'🚛', metal:'🤘', cards:'🃏',
  maritime:'⚓', sailing:'⛵', general:'🌍', entertainment:'🎙️'
};
