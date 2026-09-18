const PLACEHOLDER_PATTERNS = [
  /(?:^|[\/_\-.])(placeholder|place-holder)(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])(no[-_ ]?image|noimage|image[-_ ]?not[-_ ]?found|missing[-_ ]?image)(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])(fallback|dummy|blank|transparent|spacer|pixel|loading)(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])(default[-_ ]?(image|img|photo|picture|thumbnail|thumb|og|share|social))(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])(generic[-_ ]?(image|img|photo|picture|thumbnail|thumb))(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])(favicon|apple[-_ ]?touch[-_ ]?icon)(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])(site[-_ ]?logo|logo[-_ ]?(header|footer|site|default)|brand[-_ ]?logo)(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])(avatar[-_ ]?default|default[-_ ]?avatar)(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])1x1(?:[\/_\-.]|$)/i
];

export function isPlaceholderImageUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return true;
  if (/^data:/i.test(raw) || /^blob:/i.test(raw)) return true;
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch {}
  const test = `${raw} ${decoded}`.toLowerCase();
  if (/\.svg(?:[?#]|$)/i.test(raw)) return true;
  if (/transparent\.gif(?:[?#]|$)|spacer\.gif(?:[?#]|$)|pixel\.gif(?:[?#]|$)/i.test(raw)) return true;
  return PLACEHOLDER_PATTERNS.some(re => re.test(test));
}

export function sanitizeImageUrl(value = '') {
  const raw = String(value || '').trim();
  return isPlaceholderImageUrl(raw) ? '' : raw;
}

export function suppressRepeatedImages(articles = []) {
  const counts = new Map();
  for (const a of articles) {
    const image = sanitizeImageUrl(a?.image || '');
    if (!image) continue;
    const key = `${a?.sourceId || ''}::${image}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return articles.map(a => {
    const image = sanitizeImageUrl(a?.image || '');
    if (!image) return { ...a, image: '' };
    const key = `${a?.sourceId || ''}::${image}`;
    // Si une même image revient sur 4 cartes ou plus d'une même source,
    // il s'agit très souvent d'un visuel par défaut / placeholder du site.
    return (counts.get(key) || 0) >= 4 ? { ...a, image: '' } : { ...a, image };
  });
}
