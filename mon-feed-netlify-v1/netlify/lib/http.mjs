const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';

export async function fetchText(url, { timeoutMs = 9000, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const target = new URL(url);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': UA,
        'accept': accept,
        'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.7,en;q=0.6',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'referer': `${target.protocol}//${target.host}/`,
        ...headers
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { text: await res.text(), contentType: res.headers.get('content-type') || '', finalUrl: res.url };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`timeout ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const HTML_ENTITY_MAP = Object.freeze({
  amp:'&', apos:"'", quot:'"', nbsp:' ', lt:'<', gt:'>',
  laquo:'«', raquo:'»', ndash:'–', mdash:'—', hellip:'…',
  rsquo:'’', lsquo:'‘', rdquo:'”', ldquo:'“', bull:'•', copy:'©', reg:'®'
});

export function decodeHtmlEntities(value = '') {
  let text = String(value ?? '');
  // Plusieurs flux encodent parfois une entité deux fois : &amp;#039; -> &#039; -> '
  for (let pass = 0; pass < 3; pass++) {
    const decoded = text
      .replace(/&#(\d+);?/g, (match, dec) => {
        const code = Number(dec);
        try { return code >= 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : match; } catch { return match; }
      })
      .replace(/&#x([0-9a-f]+);?/gi, (match, hex) => {
        const code = Number.parseInt(hex, 16);
        try { return Number.isFinite(code) && code >= 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : match; } catch { return match; }
      })
      .replace(/&([a-z][a-z0-9]+);/gi, (match, name) => HTML_ENTITY_MAP[name.toLowerCase()] ?? match);
    if (decoded === text) break;
    text = decoded;
  }
  return text;
}

export function cleanText(value = '') {
  return decodeHtmlEntities(String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function absoluteUrl(href, base) {
  try { return new URL(href, base).href; } catch { return ''; }
}

export function canonicalUrl(raw = '') {
  try {
    const u = new URL(raw);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_|ref$|source$)/i.test(key)) u.searchParams.delete(key);
    }
    if ([...u.searchParams.keys()].length === 0) u.search = '';
    return u.href.replace(/^http:/, 'https:').replace(/\/$/, '');
  } catch { return raw; }
}

export function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
