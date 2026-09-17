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
  if (!items || (Array.isArray(items) && items.length === 0)) {
    items = data?.feed?.entry || [];
    atom = true;
  }
  if (!Array.isArray(items)) items = items ? [items] : [];
  return items.map(item => {
    const link = atom ? atomLink(item.link) : scalar(item.link || item.guid);
    const description = scalar(item['content:encoded'] || item.description || item.summary || item.content);
    const date = scalar(item.pubDate || item.published || item.updated || item['dc:date']);
    return {
      title: cleanText(scalar(item.title)),
      summary: cleanText(description).slice(0, 700),
      link: canonicalUrl(absoluteUrl(link, baseUrl)),
      publishedAt: safeDate(date)?.toISOString() || null
    };
  }).filter(x => x.title && x.link);
}

function dateFromElement($, node) {
  const time = $(node).find('time').first();
  const datetime = time.attr('datetime') || time.attr('content');
  if (datetime && safeDate(datetime)) return safeDate(datetime).toISOString();
  const text = cleanText($(node).text());
  const fr = text.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (fr) {
    const y = fr[3] ? (+fr[3] < 100 ? 2000 + +fr[3] : +fr[3]) : new Date().getFullYear();
    const d = new Date(y, +fr[2]-1, +fr[1], 12, 0, 0);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function bestContainer($, a) {
  let current = a;
  let best = a;
  let bestScore = -1;
  for (let i=0; i<6 && current?.length; i++) {
    const text = cleanText(current.text());
    const links = current.find('a').length;
    let score = 0;
    if (text.length >= 40 && text.length <= 1200) score += 3;
    if (current.find('h1,h2,h3,h4,h5,strong').length) score += 3;
    if (current.find('p').length) score += 2;
    if (current.find('time').length) score += 2;
    if (links <= 8) score += 1;
    if (score > bestScore) { best = current; bestScore = score; }
    current = current.parent();
  }
  return best;
}

export function parseGenericHtml(text, source) {
  const $ = cheerio.load(text);
  const seen = new Set();
  const out = [];
  $('a[href]').each((_, el) => {
    const href = canonicalUrl(absoluteUrl($(el).attr('href'), source.page));
    if (!href || seen.has(href)) return;
    if (source.linkPattern && !source.linkPattern.test(href)) return;
    if (!href.includes(source.domain)) return;
    let title = cleanText($(el).attr('aria-label') || $(el).attr('title') || $(el).text());
    const box = bestContainer($, $(el));
    if (title.length < 12) {
      title = cleanText(box.find('h1,h2,h3,h4,h5,strong').first().text()) || title;
    }
    if (title.length < 12 || title.length > 220) return;
    const summary = cleanText(box.find('p').first().text()).slice(0, 700);
    const publishedAt = dateFromElement($, box);
    seen.add(href);
    out.push({ title, summary, link:href, publishedAt });
  });
  return out;
}

export function parseFFF(text, source) {
  const $ = cheerio.load(text);
  const seen = new Set();
  const rows = [];
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
    const summary = cleanText(box.find('p').first().text()).slice(0,700);
    let publishedAt = dateFromElement($, box);
    if (!publishedAt) {
      const textBox = cleanText(box.text());
      const hm = textBox.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
      if (hm) {
        const d = new Date();
        d.setHours(+hm[1], +hm[2], 0, 0);
        if (d.getTime() > Date.now() + 60*60*1000) d.setDate(d.getDate()-1);
        publishedAt = d.toISOString();
      }
    }
    seen.add(href);
    rows.push({ title, summary, link:href, publishedAt });
  });
  return rows;
}

export function parseFooty(text, source) {
  const $ = cheerio.load(text);
  const seen = new Set();
  const out = [];
  $('a[href]').each((_, el) => {
    const href = canonicalUrl(absoluteUrl($(el).attr('href'), source.page));
    if (!href || seen.has(href)) return;
    if (!/^https?:\/\/(?:www\.)?footyheadlines\.com\/(?:\d+\/)?[^?#]+\.html$/i.test(href)) return;
    const box = bestContainer($, $(el));
    let title = cleanText($(el).attr('aria-label') || $(el).attr('title') || $(el).text());
    if (title.length < 10) title = cleanText(box.find('h1,h2,h3,h4,h5,strong').first().text());
    if (title.length < 10 || title.length > 220) return;
    const summary = cleanText(box.find('p').first().text()).slice(0,700);
    let publishedAt = dateFromElement($, box);
    if (!publishedAt) {
      const t = cleanText(box.text());
      const rel = t.match(/\b(\d+)\s*(minute|minutes|min|hour|hours|hr|hrs|day|days)\s+ago\b/i);
      if (rel) {
        const n = +rel[1]; const unit = rel[2].toLowerCase();
        let ms = 0;
        if (/minute|min/.test(unit)) ms = n*60000;
        else if (/hour|hr/.test(unit)) ms = n*3600000;
        else if (/day/.test(unit)) ms = n*86400000;
        publishedAt = new Date(Date.now()-ms).toISOString();
      }
    }
    seen.add(href);
    out.push({ title, summary, link:href, publishedAt });
  });
  return out;
}
