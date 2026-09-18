import crypto from 'node:crypto';
import { SOURCES, CURRENT_PER_SOURCE, HISTORY_DAYS, isStoredArticleAllowed } from './sources.mjs';
import { fetchText, canonicalUrl } from './http.mjs';
import { parseRss, parseGenericHtml, parseFFF, parseChroniquesBleues, parseMarkdownLinks, parseSitemap, sitemapItems } from './parsers.mjs';
import { analyzeTitle } from './antiClickbait.mjs';
import { readCurrent, writeCurrent, readSeen, writeSeen, appendToArchive, readQueue, writeQueue, pruneHistory } from './storage.mjs';

const GLOBAL_NOISE=/\b(mentions? légales?|qui sommes[- ]nous|politique de confidentialité|gestion des cookies|préférences cookies|contactez[- ]nous|conditions générales|plan du site)\b/i;
const nowIso=()=>new Date().toISOString();
function idFor(sourceId,link,title){return `${sourceId}_${crypto.createHash('sha1').update(link||title).digest('hex').slice(0,18)}`}
function dateValue(x){const t=x?.publishedAt?Date.parse(x.publishedAt):0;return Number.isFinite(t)?t:0}
function sourceDefaultAvailability(source){return source.availabilityDefault==='mixed'?'unknown':(source.availabilityDefault||'unknown')}
function inferMedia(title='',summary=''){const t=`${title} ${summary}`;const m=[];if(/\bvid[ée]o\b|en images?|à voir/i.test(t))m.push('video');return m}
function allowed(source,item){
  const title=(item.title||'').trim(), summary=(item.summary||'').trim(), link=item.link||''; const text=`${title} ${summary} ${link}`;
  if(!title||!link||GLOBAL_NOISE.test(title))return false;
  if(source.includeTitle&&!source.includeTitle.test(title))return false;
  if(source.includeText&&!source.includeText.test(text))return false;
  if(source.excludeTitle&&source.excludeTitle.test(title))return false;
  if(source.excludeUrl&&source.excludeUrl.test(link))return false;
  return true;
}
function normalize(source,item,index=0,mode='rss',seen={}){
  const originalTitle=(item.title||'').trim(); const summary=(item.summary||'').trim(); const link=canonicalUrl(item.link||'');
  if(!originalTitle||!link)return null; const analysis=analyzeTitle(originalTitle,summary);
  const inferred=!item.publishedAt&&['html','reader','sitemap'].includes(mode); const publishedAt=item.publishedAt||(inferred?new Date(Date.now()-index*60000).toISOString():null);
  const id=idFor(source.id,link,originalTitle); const discoveredAt=seen[id]||nowIso();
  return {id,sourceId:source.id,source:source.name,domain:source.domain,category:source.category,icon:source.icon,color:source.color,
    title:analysis.cleanTitle,originalTitle,summary,link,publishedAt,dateInferred:inferred,discoveredAt,
    clickbaitScore:analysis.clickbaitScore,clickbaitReasons:analysis.clickbaitReasons||[],entity:analysis.entity,entityConfidence:analysis.confidence,
    antiClickbait:{rewritten:analysis.rewritten||false,mode:analysis.rewriteMode||'none',confidence:analysis.confidence||0},
    image:item.image||'',availability:sourceDefaultAvailability(source),media:inferMedia(originalTitle,summary),enrichedAt:null};
}
function mergeCurrent(fresh=[],previous=[]){
  const map=new Map();for(const item of [...fresh,...previous]){if(!item?.id)continue;if(!map.has(item.id))map.set(item.id,item)}
  return [...map.values()].sort((a,b)=>dateValue(b)-dateValue(a)).slice(0,CURRENT_PER_SOURCE);
}
async function viaRss2Json(rssUrl){
  const endpoint=`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;const {text}=await fetchText(endpoint,{timeoutMs:7000,accept:'application/json,text/plain,*/*'});
  let data;try{data=JSON.parse(text)}catch{throw new Error('RSS2JSON réponse non JSON')};if(data?.status!=='ok'||!Array.isArray(data?.items))throw new Error(data?.message||'RSS2JSON échec');
  const items=data.items.map(x=>({title:x.title||'',summary:x.description||x.content||'',link:x.link||x.guid||'',publishedAt:x.pubDate?new Date(x.pubDate).toISOString():null,image:x.thumbnail||x.enclosure?.link||''})).filter(x=>x.title&&x.link);
  if(!items.length)throw new Error('RSS2JSON vide');return{mode:'rss-proxy',items,endpoint};
}
async function viaRss(source){let lastError=null;for(const url of source.rss||[]){try{const{text}=await fetchText(url,{timeoutMs:7500,accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.8'});const items=parseRss(text,url);if(items.length)return{mode:'rss',items,endpoint:url};lastError=new Error('RSS vide')}catch(error){lastError=error;if(source.rss2jsonFallback){try{return await viaRss2Json(url)}catch(e){lastError=new Error(`${error.message}; RSS2JSON: ${e.message}`)}}}}throw lastError||new Error('Aucun RSS')}
async function viaReader(source){if(!source.page)throw new Error('Aucune page reader');const endpoint=`https://r.jina.ai/${source.page}`;const{text}=await fetchText(endpoint,{timeoutMs:8000,accept:'text/plain,text/markdown,*/*'});const items=parseMarkdownLinks(text,source);if(!items.length)throw new Error('reader: 0 article détecté');return{mode:'reader',items,endpoint}}
async function viaSitemap(source){
  if(!source.sitemap)throw new Error('Aucun sitemap');const root=await fetchText(source.sitemap,{timeoutMs:7500,accept:'application/xml,text/xml,*/*;q=0.8'});let parsed=parseSitemap(root.text),entries=parsed.urls;
  if(!entries.length&&parsed.sitemaps.length){let maps=parsed.sitemaps;const preferred=maps.filter(x=>/article|post|news|actual|content|page/i.test(x.loc));if(preferred.length)maps=preferred;maps=maps.sort((a,b)=>Date.parse(b.lastmod||0)-Date.parse(a.lastmod||0)).slice(0,8);const batches=await Promise.allSettled(maps.map(async m=>{const r=await fetchText(m.loc,{timeoutMs:6000,accept:'application/xml,text/xml,*/*;q=0.8'});return parseSitemap(r.text).urls}));entries=batches.flatMap(x=>x.status==='fulfilled'?x.value:[])}
  const items=sitemapItems(entries,source).sort((a,b)=>dateValue(b)-dateValue(a));if(!items.length)throw new Error('sitemap: 0 article correspondant');return{mode:'sitemap',items,endpoint:source.sitemap};
}
async function viaHtml(source){if(!source.page)throw new Error('Aucune page directe');const{text}=await fetchText(source.page,{timeoutMs:8500});let items;if(source.adapter==='fff')items=parseFFF(text,source);else if(source.adapter==='chroniquesBleues')items=parseChroniquesBleues(text,source);else items=parseGenericHtml(text,source);if(!items.length)throw new Error('0 article détecté sur la page');return{mode:'html',items,endpoint:source.page}}
async function fetchSource(source){
  if(source.disabled)return{disabled:true,mode:'disabled',items:[],error:source.disabledReason||'Source désactivée'};const errors=[];
  if(source.rss?.length){try{return await viaRss(source)}catch(e){errors.push(`RSS: ${e.message}`)}}
  if(source.adapter==='sitemap'){try{return await viaSitemap(source)}catch(e){errors.push(`SITEMAP: ${e.message}`)}}
  if(source.page&&source.adapter!=='sitemap'){try{return await viaHtml(source)}catch(e){errors.push(`HTML: ${e.message}`)}}
  if(source.readerFallback){try{return await viaReader(source)}catch(e){errors.push(`READER: ${e.message}`)}}
  throw new Error(errors.join(' | ')||'Aucune méthode de collecte');
}
async function collectOne(source,previousMeta,previousItems,seen){
  const started=Date.now();
  try{
    const result=await fetchSource(source);if(result.disabled)return{meta:{id:source.id,name:source.name,category:source.category,icon:source.icon,color:source.color,status:'disabled',mode:'disabled',count:0,candidates:0,newCount:0,error:result.error,updatedAt:nowIso(),lastSuccessAt:previousMeta?.lastSuccessAt||null,durationMs:Date.now()-started},current:[],candidates:[]};
    const depth=source.collectDepth||30;const candidates=result.items.slice(0,depth).filter(x=>allowed(source,x)).map((x,i)=>normalize(source,x,i,result.mode,seen)).filter(Boolean);
    const current=source.replaceCurrentOnSuccess ? [...candidates].sort((a,b)=>dateValue(b)-dateValue(a)).slice(0,CURRENT_PER_SOURCE) : mergeCurrent(candidates,previousItems);const freshCount=candidates.filter(x=>!seen[x.id]).length;const now=nowIso();
    return{meta:{id:source.id,name:source.name,category:source.category,icon:source.icon,color:source.color,status:'ok',mode:result.mode,endpoint:result.endpoint,count:current.length,candidates:candidates.length,newCount:freshCount,error:null,updatedAt:now,lastSuccessAt:now,durationMs:Date.now()-started},current,candidates};
  }catch(error){const current=previousItems||[];return{meta:{id:source.id,name:source.name,category:source.category,icon:source.icon,color:source.color,status:current.length?'stale':'error',mode:previousMeta?.mode||'error',endpoint:previousMeta?.endpoint||source.page||source.sitemap||source.rss?.[0]||null,count:current.length,candidates:0,newCount:0,error:error?.message||String(error),updatedAt:nowIso(),lastSuccessAt:previousMeta?.lastSuccessAt||null,durationMs:Date.now()-started},current,candidates:[]}}
}
function pruneSeen(seen){const cutoff=Date.now()-HISTORY_DAYS*86400000;const out={};for(const[id,iso]of Object.entries(seen||{})){const t=Date.parse(iso);if(Number.isFinite(t)&&t>=cutoff)out[id]=iso}return out}

export async function collectAll(){
  const cycleStartedAt=nowIso();const previous=await readCurrent();const seen=pruneSeen(await readSeen());
  const previousMeta=new Map((previous?.sources||[]).map(x=>[x.id,x]));const previousItems=new Map();for(const item of previous?.articles||[]){if(!previousItems.has(item.sourceId))previousItems.set(item.sourceId,[]);previousItems.get(item.sourceId).push(item)}
  const results=await Promise.all(SOURCES.map(source=>collectOne(source,previousMeta.get(source.id),previousItems.get(source.id)||[],seen)));
  const discovered=[];for(const r of results){for(const item of r.candidates){if(!seen[item.id]){seen[item.id]=item.discoveredAt;discovered.push(item)}}}
  if(discovered.length)await appendToArchive(discovered);await writeSeen(seen);
  const sources=results.map(r=>r.meta);const articles=results.flatMap(r=>r.current).sort((a,b)=>dateValue(b)-dateValue(a));
  const queue=(await readQueue()).filter(isStoredArticleAllowed);const queued=new Set(queue.map(x=>x.id));const priorities=[...articles.filter(x=>!x.enrichedAt),...discovered.filter(x=>!x.enrichedAt)];for(const item of priorities){if(!queued.has(item.id)){queue.push({id:item.id,link:item.link,sourceId:item.sourceId,discoveredAt:item.discoveredAt});queued.add(item.id)}}await writeQueue(queue);
  const ok=sources.filter(s=>s.status==='ok').length,stale=sources.filter(s=>s.status==='stale').length,errors=sources.filter(s=>s.status==='error').length,disabled=sources.filter(s=>s.status==='disabled').length;
  const feed={version:'2.1.2',generatedAt:nowIso(),cycleStartedAt,currentPerSource:CURRENT_PER_SOURCE,historyDays:HISTORY_DAYS,stats:{sources:sources.length,ok,stale,errors,disabled,articles:articles.length,newThisCycle:discovered.length},sources,articles};
  await writeCurrent(feed);const deletedArchives=await pruneHistory();return{...feed,maintenance:{deletedArchives,queue:queue.length}};
}
