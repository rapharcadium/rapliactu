import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import { absoluteUrl, canonicalUrl, cleanText, safeDate } from './http.mjs';

const xml = new XMLParser({ ignoreAttributes:false, attributeNamePrefix:'@_', textNodeName:'#text', cdataPropName:'#cdata', processEntities:true, trimValues:true });

function scalar(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return scalar(value[0]);
  if (typeof value === 'object') return scalar(value['#cdata'] ?? value['#text'] ?? '');
  return '';
}
function atomLink(link) {
  if (!link) return '';
  const links = Array.isArray(link) ? link : [link];
  const preferred = links.find(x => typeof x === 'object' && (x['@_rel'] === 'alternate' || !x['@_rel']) && x['@_href']) || links.find(x => typeof x === 'object' && x['@_href']);
  return preferred?.['@_href'] || scalar(links[0]);
}
function imageFromDescription(html = '', baseUrl = '') {
  const m = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? canonicalUrl(absoluteUrl(m[1], baseUrl)) : '';
}
function rssImage(item, baseUrl) {
  const media = item?.['media:content'] || item?.['media:thumbnail'];
  const arr = Array.isArray(media) ? media : (media ? [media] : []);
  const mediaUrl = arr.find(x => x?.['@_url'])?.['@_url'];
  if (mediaUrl) return canonicalUrl(absoluteUrl(mediaUrl, baseUrl));
  const enc = item?.enclosure;
  if (enc?.['@_url'] && (!enc?.['@_type'] || String(enc['@_type']).startsWith('image/'))) return canonicalUrl(absoluteUrl(enc['@_url'], baseUrl));
  return imageFromDescription(scalar(item['content:encoded'] || item.description || item.summary || item.content), baseUrl);
}

export function parseRss(text, baseUrl) {
  const data = xml.parse(text);
  let items = data?.rss?.channel?.item || data?.['rdf:RDF']?.item || [];
  let atom = false;
  if (!items || (Array.isArray(items) && items.length === 0)) { items = data?.feed?.entry || []; atom = true; }
  if (!Array.isArray(items)) items = items ? [items] : [];
  return items.map(item => {
    const link = atom ? atomLink(item.link) : scalar(item.link || item.guid);
    const rawDescription = scalar(item['content:encoded'] || item.description || item.summary || item.content);
    const date = scalar(item.pubDate || item.published || item.updated || item['dc:date']);
    return {
      title: cleanText(scalar(item.title)), summary: cleanText(rawDescription).slice(0, 900),
      link: canonicalUrl(absoluteUrl(link, baseUrl)), publishedAt: safeDate(date)?.toISOString() || null,
      image: rssImage(item, baseUrl)
    };
  }).filter(x => x.title && x.link);
}

function dateFromElement($, node) {
  const time = $(node).find('time').first();
  const datetime = time.attr('datetime') || time.attr('content');
  if (datetime && safeDate(datetime)) return safeDate(datetime).toISOString();
  const text = cleanText($(node).text());
  const fr = text.match(/\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b/);
  if (fr) {
    const y = fr[3] ? (+fr[3] < 100 ? 2000 + +fr[3] : +fr[3]) : new Date().getFullYear();
    const d = new Date(y, +fr[2]-1, +fr[1], 12, 0, 0);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const words = text.match(/\b(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(20\d{2})\b/i);
  if (words) {
    const months = {janvier:0,'février':1,fevrier:1,mars:2,avril:3,mai:4,juin:5,juillet:6,'août':7,aout:7,septembre:8,octobre:9,novembre:10,'décembre':11,decembre:11};
    const d = new Date(+words[3], months[words[2].toLowerCase()], +words[1], 12, 0, 0);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}
function bestContainer($, a) {
  let current = a, best = a, bestScore = -1;
  for (let i=0; i<6 && current?.length; i++) {
    const text = cleanText(current.text()); const links = current.find('a').length;
    let score = 0;
    if (text.length >= 40 && text.length <= 1800) score += 3;
    if (current.find('h1,h2,h3,h4,h5,strong').length) score += 3;
    if (current.find('p').length) score += 2;
    if (current.find('time').length) score += 2;
    if (current.find('img').length) score += 1;
    if (links <= 10) score += 1;
    if (score > bestScore) { best = current; bestScore = score; }
    current = current.parent();
  }
  return best;
}
function imageFromBox($, box, base) {
  const img = box.find('img').filter((_,el) => !!($(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src'))).first();
  const raw = img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src') || '';
  return raw ? canonicalUrl(absoluteUrl(raw, base)) : '';
}

export function parseGenericHtml(text, source) {
  const $ = cheerio.load(text); const seen = new Set(); const out = [];
  $('a[href]').each((_, el) => {
    const href = canonicalUrl(absoluteUrl($(el).attr('href'), source.page));
    if (!href || seen.has(href)) return;
    if (source.linkPattern && !source.linkPattern.test(href)) return;
    if (!href.includes(source.domain)) return;
    let title = cleanText($(el).attr('aria-label') || $(el).attr('title') || $(el).text());
    const box = bestContainer($, $(el));
    if (title.length < 12) title = cleanText(box.find('h1,h2,h3,h4,h5,strong').first().text()) || title;
    if (title.length < 12 || title.length > 240) return;
    const summary = cleanText(box.find('p').first().text()).slice(0, 900);
    const publishedAt = dateFromElement($, box);
    const image = imageFromBox($, box, source.page);
    seen.add(href); out.push({ title, summary, link:href, publishedAt, image });
  });
  return out;
}

export function parseChroniquesBleues(text, source) {
  const $ = cheerio.load(text); const seen = new Set(); const out = [];

  // La page d'accueil présente les vrais articles sous forme de titres H2.
  // On évite volontairement le scan de tous les liens : menus, statistiques,
  // pages auteurs, pagination, partenaires et autres pages éditoriales ne sont
  // donc plus susceptibles de remonter comme de fausses actualités.
  $('h2 a[href]').each((_, el) => {
    const href = canonicalUrl(absoluteUrl($(el).attr('href'), source.page));
    if (!href || seen.has(href) || !href.includes(source.domain)) return;

    const title = cleanText($(el).text());
    if (title.length < 8 || title.length > 240) return;

    const heading = $(el).closest('h2');
    let box = heading.parent();
    let publishedAt = null;
    for (let i = 0; i < 5 && box?.length; i++) {
      publishedAt = dateFromElement($, box);
      if (publishedAt && /publi[ée]\s+le/i.test(cleanText(box.text()))) break;
      box = box.parent();
    }

    // Chroniques Bleues affiche une date "Publié le ..." pour chaque article.
    // Sans date explicite, on préfère ignorer le lien plutôt que de lui inventer
    // une date récente qui le propulserait artificiellement en haut du feed.
    if (!publishedAt) return;

    let summary = '';
    const container = box?.length ? box : heading.parent();
    const paragraphs = container.find('p').map((_, p) => cleanText($(p).text())).get().filter(Boolean);
    if (paragraphs.length) summary = paragraphs[0].slice(0, 900);
    if (!summary) {
      const next = heading.nextAll('p').first();
      summary = cleanText(next.text()).slice(0, 900);
    }

    const image = imageFromBox($, container, source.page);
    seen.add(href);
    out.push({ title, summary, link: href, publishedAt, image });
  });

  return out;
}

export function parseFFF(text, source) {
  const $ = cheerio.load(text); const seen = new Set(); const rows = [];
  $('a[href*="/article/"]').each((_, el) => {
    const href = canonicalUrl(absoluteUrl($(el).attr('href'), source.page));
    if (!href || seen.has(href) || !/fff\.fr\/article\/\d+-/i.test(href)) return;
    const box = bestContainer($, $(el));
    let title = cleanText($(el).find('h1,h2,h3,h4,h5,strong').first().text()) || cleanText($(el).text());
    if (title.length < 8) title = cleanText(box.find('h1,h2,h3,h4,h5,strong').first().text());
    if (title.length < 8) {
      const slug = href.match(/\/article\/\d+-(.+?)\.html/i)?.[1] || '';
      title = decodeURIComponent(slug).replace(/-/g,' ').replace(/^./, c => c.toUpperCase());
    }
    const summary = cleanText(box.find('p').first().text()).slice(0,900);
    let publishedAt = dateFromElement($, box);
    if (!publishedAt) {
      const textBox = cleanText(box.text()); const hm = textBox.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
      if (hm) { const d = new Date(); d.setHours(+hm[1], +hm[2], 0, 0); if (d.getTime() > Date.now()+3600000) d.setDate(d.getDate()-1); publishedAt = d.toISOString(); }
    }
    seen.add(href); rows.push({ title, summary, link:href, publishedAt, image:imageFromBox($, box, source.page) });
  });
  return rows;
}

function titleFromUrl(url = '') {
  try { const u=new URL(url); const last=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||''); return last.replace(/^l1_article_\d+-?/i,'').replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim().replace(/^./,c=>c.toUpperCase()); } catch { return ''; }
}
export function parseMarkdownLinks(text, source) {
  const out=[]; const seen=new Set(); const re=/\[([^\]]{4,240})\]\((https?:\/\/[^)\s]+)\)/g; let m;
  while ((m=re.exec(text))) {
    const link=canonicalUrl(m[2]); if(!link||seen.has(link))continue; if(source.linkPattern&&!source.linkPattern.test(link))continue; if(!link.includes(source.domain))continue;
    const title=cleanText(m[1]); if(title.length<8||title.length>240)continue;
    const tail=cleanText(text.slice(re.lastIndex,re.lastIndex+650)); let publishedAt=null; const iso=tail.match(/\b(20\d{2})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/); if(iso)publishedAt=safeDate(iso[0])?.toISOString()||null;
    seen.add(link); out.push({title,summary:tail.slice(0,500),link,publishedAt,image:''});
  }
  return out;
}
export function parseSitemap(text) {
  const data=xml.parse(text); const urlsRaw=data?.urlset?.url||[]; const mapsRaw=data?.sitemapindex?.sitemap||[];
  const urls=(Array.isArray(urlsRaw)?urlsRaw:(urlsRaw?[urlsRaw]:[])).map(x=>({loc:scalar(x.loc),lastmod:scalar(x.lastmod)})).filter(x=>x.loc);
  const sitemaps=(Array.isArray(mapsRaw)?mapsRaw:(mapsRaw?[mapsRaw]:[])).map(x=>({loc:scalar(x.loc),lastmod:scalar(x.lastmod)})).filter(x=>x.loc);
  return {urls,sitemaps};
}
export function sitemapItems(entries=[],source){return entries.filter(x=>source.sitemapPattern?source.sitemapPattern.test(x.loc):true).map(x=>({title:titleFromUrl(x.loc),summary:'',link:canonicalUrl(x.loc),publishedAt:safeDate(x.lastmod)?.toISOString()||null,image:''})).filter(x=>x.title&&x.link)}

export function parseArticleMeta(text, url) {
  const $=cheerio.load(text);
  const meta=(name,prop=false)=>$(prop?`meta[property="${name}"]`:`meta[name="${name}"]`).attr('content')||'';
  const image=canonicalUrl(absoluteUrl(meta('og:image',true)||meta('twitter:image')||$('article img').first().attr('src')||'',url));
  const description=cleanText(meta('description')||meta('og:description',true)||'').slice(0,900);
  const htmlLower=String(text).toLowerCase();
  const media=[];
  if (/youtube\.com|youtu\.be/.test(htmlLower)) media.push('youtube');
  if (/x\.com\/|twitter\.com\//.test(htmlLower)) media.push('x');
  if (/instagram\.com\//.test(htmlLower)) media.push('instagram');
  if (/facebook\.com\//.test(htmlLower)) media.push('facebook');
  if (/tiktok\.com\//.test(htmlLower)) media.push('tiktok');
  if (/<video\b|\.mp4(?:[?"'])/.test(htmlLower)) media.push('video');
  let availability='unknown';
  const ld=$('script[type="application/ld+json"]').map((_,el)=>$(el).html()).get().join(' ');
  if (/"isAccessibleForFree"\s*:\s*false/i.test(ld) || /article réservé aux abonnés|réservé aux abonnés|abonnez-vous pour lire|contenu réservé|accès réservé/i.test(text)) availability='paywall';
  else if (/connectez-vous pour (?:lire|continuer)|créez un compte pour|identifiez-vous pour/i.test(text)) availability='account';
  else if (/"isAccessibleForFree"\s*:\s*true/i.test(ld)) availability='free';

  // Texte temporaire utilisé uniquement par l'Anti‑Putaclic V2.
  // On privilégie le corps éditorial et on ne le persiste jamais dans le feed.
  $('script,style,noscript,nav,header,footer,aside,form').remove();
  const paragraphText = $('article p, main p, [itemprop=\"articleBody\"] p, .article-content p, .post-content p')
    .map((_,el)=>cleanText($(el).text())).get().filter(Boolean).join(' ');
  const bodyText = cleanText(paragraphText || $('article').text() || $('main').text() || '').slice(0,12000);
  return {image,description,media:[...new Set(media)],availability,bodyText};
}
