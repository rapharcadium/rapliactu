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
      link: canonicalUrl(absoluteUrl(link, baseUrl)), publishedAt: safeDate(date)?.toISOString() || null
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
    seen.add(href); out.push({ title, summary, link:href, publishedAt });
  });
  return out;
}


function leMarinArticleUrl(url = '') {
  try {
    const u = new URL(url);
    if (u.hostname !== 'lemarin.ouest-france.fr') return false;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return false; // /shipping, /peche, etc. = rubriques, pas articles
    const last = parts.at(-1) || '';
    if (last.length < 18 || !last.includes('-')) return false;
    const banned = /^(?:connexion|abonnement|mentions|contact|recherche|newsletter|evenements?|podcasts?|videos?|dossiers?)$/i;
    if (parts.some(part => banned.test(part))) return false;
    // Les articles récents du Marin finissent généralement par un UUID ; les anciens
    // peuvent finir par un identifiant numérique. On accepte aussi un slug éditorial
    // long, mais seulement si une date explicite est trouvée dans la carte.
    return true;
  } catch { return false; }
}

function explicitDateFromBox($, box) {
  const meta = box.find('[itemprop="datePublished"],meta[property="article:published_time"],meta[name="date"],meta[name="pubdate"]').first();
  const raw = meta.attr('datetime') || meta.attr('content') || meta.attr('value');
  if (raw && safeDate(raw)) return safeDate(raw).toISOString();
  return dateFromElement($, box);
}

function walkJson(value, visit) {
  if (!value) return;
  if (Array.isArray(value)) { for (const item of value) walkJson(item, visit); return; }
  if (typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) walkJson(child, visit);
}

export function parseLeMarin(text, source) {
  const $ = cheerio.load(text); const byUrl = new Map();
  const add = item => {
    const link = canonicalUrl(absoluteUrl(item.link, source.page));
    const title = cleanText(item.title || '');
    if (!link || !leMarinArticleUrl(link) || title.length < 12 || title.length > 240 || !item.publishedAt) return;
    const existing = byUrl.get(link);
    if (!existing || Date.parse(item.publishedAt) > Date.parse(existing.publishedAt || 0)) {
      byUrl.set(link, { title, summary:cleanText(item.summary || '').slice(0,900), link, publishedAt:item.publishedAt });
    }
  };

  // 1) Données structurées : quand la home expose des NewsArticle/Article, c'est la
  // source la plus fiable pour headline + URL + datePublished.
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || 'null');
      walkJson(data, node => {
        const type = Array.isArray(node['@type']) ? node['@type'].join(' ') : String(node['@type'] || '');
        if (!/(?:NewsArticle|Article|ReportageNewsArticle)/i.test(type)) return;
        let link = node.url || node.mainEntityOfPage?.['@id'] || node.mainEntityOfPage?.url || '';
        const publishedAt = safeDate(node.datePublished || node.dateCreated || '')?.toISOString() || null;
        add({ title:node.headline || node.name || '', summary:node.description || '', link, publishedAt });
      });
    } catch { /* JSON-LD invalide : on poursuit avec le DOM */ }
  });

  // 2) Cartes de la page. Contrairement au parseur générique, une date explicite
  // est OBLIGATOIRE : aucune date artificielle ne sera fabriquée pour Le Marin.
  $('a[href]').each((_, el) => {
    const link = canonicalUrl(absoluteUrl($(el).attr('href'), source.page));
    if (!link || !leMarinArticleUrl(link)) return;
    const a = $(el); const box = bestContainer($, a);
    let title = cleanText(a.attr('aria-label') || a.attr('title') || a.find('h1,h2,h3,h4,h5,strong').first().text() || a.text());
    if (title.length < 12) title = cleanText(box.find('h1,h2,h3,h4,h5,strong').first().text()) || title;
    const publishedAt = explicitDateFromBox($, box);
    if (!publishedAt) return;
    const summary = cleanText(box.find('p').first().text()).slice(0,900);
    add({ title, summary, link, publishedAt });
  });

  return [...byUrl.values()].sort((a,b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}


export function parseLeMarinCandidates(text, source) {
  const $ = cheerio.load(text); const byUrl = new Map();
  const add = item => {
    const link = canonicalUrl(absoluteUrl(item.link, source.page));
    const title = cleanText(item.title || '');
    if (!link || !leMarinArticleUrl(link) || title.length < 12 || title.length > 240) return;
    if (!byUrl.has(link)) byUrl.set(link, { title, summary:cleanText(item.summary || '').slice(0,900), link, publishedAt:item.publishedAt || null });
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || 'null');
      walkJson(data, node => {
        const type = Array.isArray(node['@type']) ? node['@type'].join(' ') : String(node['@type'] || '');
        if (!/(?:NewsArticle|Article|ReportageNewsArticle)/i.test(type)) return;
        const link = node.url || node.mainEntityOfPage?.['@id'] || node.mainEntityOfPage?.url || '';
        const publishedAt = safeDate(node.datePublished || node.dateCreated || '')?.toISOString() || null;
        add({ title:node.headline || node.name || '', summary:node.description || '', link, publishedAt });
      });
    } catch {}
  });

  $('a[href]').each((_, el) => {
    const link = canonicalUrl(absoluteUrl($(el).attr('href'), source.page));
    if (!link || !leMarinArticleUrl(link)) return;
    const a = $(el); const box = bestContainer($, a);
    let title = cleanText(a.attr('aria-label') || a.attr('title') || a.find('h1,h2,h3,h4,h5,strong').first().text() || a.text());
    if (title.length < 12) title = cleanText(box.find('h1,h2,h3,h4,h5,strong').first().text()) || title;
    const publishedAt = explicitDateFromBox($, box);
    const summary = cleanText(box.find('p').first().text()).slice(0,900);
    add({ title, summary, link, publishedAt });
  });

  return [...byUrl.values()];
}

export function parseLeMarinArticlePage(text, fallbackUrl = '') {
  const $ = cheerio.load(text);
  const meta = (name, prop=false) => $(prop ? `meta[property="${name}"]` : `meta[name="${name}"]`).attr('content') || '';
  let title = cleanText(meta('og:title', true) || $('h1').first().text() || $('title').text());
  title = title.replace(/\s*[|–—-]\s*Le Marin\s*$/i, '').trim();
  const summary = cleanText(meta('description') || meta('og:description', true) || $('article p, main p').first().text()).slice(0,900);
  let publishedAt = null;
  const dateCandidates = [
    meta('article:published_time', true), meta('date'), meta('pubdate'), meta('datePublished'),
    $('[itemprop="datePublished"]').first().attr('datetime') || $('[itemprop="datePublished"]').first().attr('content') || '',
    $('time[datetime]').first().attr('datetime') || ''
  ].filter(Boolean);
  for (const value of dateCandidates) { const d=safeDate(value); if (d) { publishedAt=d.toISOString(); break; } }
  if (!publishedAt) {
    $('script[type="application/ld+json"]').each((_, el) => {
      if (publishedAt) return false;
      try {
        const data = JSON.parse($(el).html() || 'null');
        walkJson(data, node => {
          if (publishedAt) return;
          const type = Array.isArray(node['@type']) ? node['@type'].join(' ') : String(node['@type'] || '');
          if (!/(?:NewsArticle|Article|ReportageNewsArticle)/i.test(type)) return;
          const d=safeDate(node.datePublished || node.dateCreated || '');
          if (d) publishedAt=d.toISOString();
          if ((!title || title.length<8) && (node.headline || node.name)) title=cleanText(node.headline || node.name);
        });
      } catch {}
    });
  }
  const canonical = canonicalUrl(absoluteUrl($('link[rel="canonical"]').attr('href') || fallbackUrl, fallbackUrl || 'https://lemarin.ouest-france.fr/'));
  return { title, summary, link:canonical || canonicalUrl(fallbackUrl), publishedAt };
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

    seen.add(href);
    out.push({ title, summary, link: href, publishedAt });
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
    seen.add(href); rows.push({ title, summary, link:href, publishedAt });
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
    seen.add(link); out.push({title,summary:tail.slice(0,500),link,publishedAt});
  }
  return out;
}
export function parseSitemap(text) {
  const data=xml.parse(text); const urlsRaw=data?.urlset?.url||[]; const mapsRaw=data?.sitemapindex?.sitemap||[];
  const urls=(Array.isArray(urlsRaw)?urlsRaw:(urlsRaw?[urlsRaw]:[])).map(x=>({loc:scalar(x.loc),lastmod:scalar(x.lastmod)})).filter(x=>x.loc);
  const sitemaps=(Array.isArray(mapsRaw)?mapsRaw:(mapsRaw?[mapsRaw]:[])).map(x=>({loc:scalar(x.loc),lastmod:scalar(x.lastmod)})).filter(x=>x.loc);
  return {urls,sitemaps};
}
export function sitemapItems(entries=[],source){return entries.filter(x=>source.sitemapPattern?source.sitemapPattern.test(x.loc):true).map(x=>({title:titleFromUrl(x.loc),summary:'',link:canonicalUrl(x.loc),publishedAt:safeDate(x.lastmod)?.toISOString()||null})).filter(x=>x.title&&x.link)}

export function parseArticleMeta(text, url) {
  const $=cheerio.load(text);
  const meta=(name,prop=false)=>$(prop?`meta[property="${name}"]`:`meta[name="${name}"]`).attr('content')||'';
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
  return {description,media:[...new Set(media)],availability,bodyText};
}
