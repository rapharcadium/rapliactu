import crypto from 'node:crypto';
import { SOURCES, MAX_PER_SOURCE } from './sources.mjs';
import { fetchText, canonicalUrl } from './http.mjs';
import { parseRss, parseGenericHtml, parseFFF, parseFooty } from './parsers.mjs';
import { analyzeTitle } from './antiClickbait.mjs';
import { readFeed, writeFeed } from './storage.mjs';

function idFor(sourceId, link, title) {
  return `${sourceId}_${crypto.createHash('sha1').update(link || title).digest('hex').slice(0,16)}`;
}

function normalize(source, item, index = 0, mode = 'rss') {
  const originalTitle = (item.title || '').trim();
  const summary = (item.summary || '').trim();
  const link = canonicalUrl(item.link || '');
  if (!originalTitle || !link) return null;
  const analysis = analyzeTitle(originalTitle, summary);
  const inferred = !item.publishedAt && mode === 'html';
  const publishedAt = item.publishedAt || (inferred ? new Date(Date.now() - index * 60_000).toISOString() : null);
  return {
    id:idFor(source.id, link, originalTitle),
    sourceId:source.id,
    source:source.name,
    domain:source.domain,
    category:source.category,
    icon:source.icon,
    color:source.color,
    title:analysis.cleanTitle,
    originalTitle,
    summary,
    link,
    publishedAt,
    dateInferred:inferred,
    clickbaitScore:analysis.clickbaitScore,
    entity:analysis.entity,
    entityConfidence:analysis.confidence
  };
}

function dateValue(x) {
  const t = x?.publishedAt ? Date.parse(x.publishedAt) : 0;
  return Number.isFinite(t) ? t : 0;
}

function mergeItems(fresh = [], previous = []) {
  const map = new Map();
  for (const item of [...fresh, ...previous]) {
    if (!item?.link) continue;
    const key = canonicalUrl(item.link);
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()].sort((a,b) => dateValue(b)-dateValue(a)).slice(0,MAX_PER_SOURCE);
}

async function viaRss(source) {
  let lastError = null;
  for (const url of source.rss || []) {
    try {
      const { text } = await fetchText(url, { timeoutMs:8500, accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.8' });
      const items = parseRss(text, url);
      if (items.length) return { mode:'rss', items, endpoint:url };
      lastError = new Error('RSS vide');
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Aucun RSS');
}

async function viaHtml(source) {
  if (!source.page) throw new Error('Aucune page directe');
  const { text } = await fetchText(source.page, { timeoutMs:9500 });
  let items;
  if (source.adapter === 'fff') items = parseFFF(text, source);
  else if (source.adapter === 'footy') items = parseFooty(text, source);
  else items = parseGenericHtml(text, source);
  if (!items.length) throw new Error('0 article détecté sur la page');
  return { mode:'html', items, endpoint:source.page };
}

async function fetchSource(source) {
  if (source.disabled) return { disabled:true, mode:'disabled', items:[], error:source.disabledReason || 'Source désactivée' };
  let rssError = null;
  if (source.rss?.length) {
    try { return await viaRss(source); }
    catch (e) { rssError = e; }
  }
  try { return await viaHtml(source); }
  catch (htmlError) {
    const parts = [];
    if (rssError) parts.push(`RSS: ${rssError.message}`);
    parts.push(`HTML: ${htmlError.message}`);
    throw new Error(parts.join(' | '));
  }
}

async function collectOne(source, previousMeta, previousItems) {
  const started = Date.now();
  try {
    const result = await fetchSource(source);
    if (result.disabled) {
      return {
        meta:{
          id:source.id, name:source.name, category:source.category, icon:source.icon, color:source.color,
          status:'disabled', mode:'disabled', count:0, error:result.error,
          updatedAt:new Date().toISOString(), lastSuccessAt:previousMeta?.lastSuccessAt || null, durationMs:Date.now()-started
        },
        items:[]
      };
    }
    const normalized = result.items.slice(0,MAX_PER_SOURCE*3).map((x,i) => normalize(source,x,i,result.mode)).filter(Boolean);
    const items = mergeItems(normalized, previousItems);
    const now = new Date().toISOString();
    return {
      meta:{
        id:source.id, name:source.name, category:source.category, icon:source.icon, color:source.color,
        status:'ok', mode:result.mode, endpoint:result.endpoint, count:items.length,
        error:null, updatedAt:now, lastSuccessAt:now, durationMs:Date.now()-started
      },
      items
    };
  } catch (error) {
    const items = previousItems || [];
    return {
      meta:{
        id:source.id, name:source.name, category:source.category, icon:source.icon, color:source.color,
        status:items.length ? 'stale' : 'error', mode:previousMeta?.mode || 'error',
        endpoint:previousMeta?.endpoint || source.page || source.rss?.[0] || null,
        count:items.length, error:error?.message || String(error), updatedAt:new Date().toISOString(),
        lastSuccessAt:previousMeta?.lastSuccessAt || null, durationMs:Date.now()-started
      },
      items
    };
  }
}

export async function collectAll() {
  const cycleStartedAt = new Date().toISOString();
  const previous = await readFeed();
  const previousMeta = new Map((previous?.sources || []).map(x => [x.id,x]));
  const previousItems = new Map();
  for (const item of previous?.articles || []) {
    if (!previousItems.has(item.sourceId)) previousItems.set(item.sourceId, []);
    previousItems.get(item.sourceId).push(item);
  }

  // Toutes les sources partent en parallèle. Chaque requête est bornée à moins de 10 s,
  // donc une source lente ne bloque pas le cycle entier pendant des dizaines de secondes.
  const results = await Promise.all(SOURCES.map(source => collectOne(source, previousMeta.get(source.id), previousItems.get(source.id) || [])));
  const sources = results.map(r => r.meta);
  const articles = results.flatMap(r => r.items).sort((a,b) => dateValue(b)-dateValue(a));
  const ok = sources.filter(s => s.status === 'ok').length;
  const stale = sources.filter(s => s.status === 'stale').length;
  const errors = sources.filter(s => s.status === 'error').length;
  const disabled = sources.filter(s => s.status === 'disabled').length;
  const feed = {
    version:'1.0.0',
    generatedAt:new Date().toISOString(),
    cycleStartedAt,
    maxPerSource:MAX_PER_SOURCE,
    stats:{ sources:sources.length, ok, stale, errors, disabled, articles:articles.length },
    sources,
    articles
  };
  // Une seule écriture Blob par cycle : plus rapide, moins coûteux et atomique côté lecteur.
  await writeFeed(feed);
  return feed;
}
