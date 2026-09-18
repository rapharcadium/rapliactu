import { fetchText } from './http.mjs';
import { parseArticleMeta } from './parsers.mjs';
import { analyzeTitle } from './antiClickbait.mjs';
import { SOURCES, ACTIVE_SOURCE_IDS } from './sources.mjs';
import { sanitizeImageUrl } from './images.mjs';
import { readCurrent, writeCurrent, readQueue, writeQueue, readDay, writeDay, isoDay } from './storage.mjs';

const BATCH=36,CONCURRENCY=12;
const sourceMap=new Map(SOURCES.map(s=>[s.id,s]));

function mergeMeta(article,meta,source){
  const availability=meta.availability!=='unknown'?meta.availability:(article.availability||((source?.availabilityDefault&&source.availabilityDefault!=='mixed')?source.availabilityDefault:'unknown'));
  // Deuxième passe Anti‑Putaclic : titre + résumé + texte réel de l'article.
  const analysis=analyzeTitle(article.originalTitle||article.title||'', article.summary||meta.description||'', meta.bodyText||'');
  return {
    ...article,
    title:analysis.cleanTitle||article.title,
    clickbaitScore:analysis.clickbaitScore,
    clickbaitReasons:analysis.clickbaitReasons||[],
    entity:analysis.entity||article.entity||null,
    entityConfidence:analysis.confidence||0,
    antiClickbait:{rewritten:analysis.rewritten||false,mode:analysis.rewriteMode||'none',confidence:analysis.confidence||0},
    image:sanitizeImageUrl(meta.image||article.image||''),
    summary:article.summary||meta.description||'',
    availability,
    media:[...new Set([...(article.media||[]),...(meta.media||[])])],
    enrichedAt:new Date().toISOString()
  };
}
async function fetchMeta(q,article){
  try{const{text}=await fetchText(q.link,{timeoutMs:5500});return{ok:true,id:q.id,updated:mergeMeta(article,parseArticleMeta(text,q.link),sourceMap.get(article.sourceId))}}
  catch(error){return{ok:false,id:q.id,error:error?.message||String(error)}}
}
export async function enrichBatch(){
  const current=await readCurrent();if(!current)return{processed:0,remaining:0,ok:0,errors:0,logs:[]};const queue=(await readQueue()).filter(x=>ACTIVE_SOURCE_IDS.has(x.sourceId));current.sources=(current.sources||[]).filter(x=>ACTIVE_SOURCE_IDS.has(x.id));current.articles=(current.articles||[]).filter(x=>ACTIVE_SOURCE_IDS.has(x.sourceId));const batch=queue.slice(0,BATCH),rest=queue.slice(BATCH);const currentMap=new Map((current.articles||[]).map(x=>[x.id,x]));const dayCache=new Map(),dayDirty=new Set();
  async function articleFor(q){if(currentMap.has(q.id))return currentMap.get(q.id);const day=isoDay(q.discoveredAt||new Date());if(!dayCache.has(day))dayCache.set(day,await readDay(day));return(dayCache.get(day)||[]).find(x=>x.id===q.id)||null}
  const retry=[],logs=[];let currentDirty=false;
  for(let i=0;i<batch.length;i+=CONCURRENCY){const group=batch.slice(i,i+CONCURRENCY);const pairs=await Promise.all(group.map(async q=>({q,article:await articleFor(q)})));const results=await Promise.all(pairs.map(({q,article})=>article?fetchMeta(q,article):Promise.resolve({ok:true,id:q.id,skip:true})));
    for(let j=0;j<results.length;j++){const r=results[j],q=group[j];if(r.updated){if(currentMap.has(r.id)){currentMap.set(r.id,r.updated);currentDirty=true}const day=isoDay(r.updated.discoveredAt||r.updated.publishedAt||new Date());if(!dayCache.has(day))dayCache.set(day,await readDay(day));dayCache.set(day,(dayCache.get(day)||[]).map(x=>x.id===r.id?r.updated:x));dayDirty.add(day);logs.push({ok:true,id:r.id,image:!!r.updated.image,media:r.updated.media.length,availability:r.updated.availability,antiClickbait:r.updated.antiClickbait})}else{logs.push(r);if(!r.ok){const attempts=(q.attempts||0)+1;if(attempts<3)retry.push({...q,attempts})}}}
  }
  if(currentDirty){current.articles=[...currentMap.values()].sort((a,b)=>Date.parse(b.publishedAt||b.discoveredAt||0)-Date.parse(a.publishedAt||a.discoveredAt||0));current.enrichedAt=new Date().toISOString();await writeCurrent(current)}for(const day of dayDirty)await writeDay(day,dayCache.get(day)||[]);await writeQueue([...rest,...retry]);return{processed:batch.length,remaining:rest.length+retry.length,ok:logs.filter(x=>x.ok).length,errors:logs.filter(x=>!x.ok).length,rewritten:logs.filter(x=>x.antiClickbait?.rewritten).length,logs};
}
