const UA = 'MonFeed/1.0 (+personal news aggregator; Netlify)';

export async function fetchText(url, { timeoutMs = 9000, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': UA,
        'accept': accept,
        'accept-language': 'fr-FR,fr;q=0.9,en;q=0.7',
        'cache-control': 'no-cache'
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

export function cleanText(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
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
