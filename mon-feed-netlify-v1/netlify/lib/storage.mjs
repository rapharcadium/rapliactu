import { getStore } from '@netlify/blobs';

const STORE = 'mon-feed';
export const FEED_KEY = 'feed/current';

export function store() { return getStore(STORE); }

export async function readFeed() {
  try { return await store().get(FEED_KEY, { type:'json', consistency:'strong' }); }
  catch { return null; }
}

export async function writeFeed(value) {
  return store().setJSON(FEED_KEY, value, {
    metadata:{
      generatedAt:value.generatedAt || new Date().toISOString(),
      articles:value.stats?.articles || 0,
      ok:value.stats?.ok || 0,
      stale:value.stats?.stale || 0,
      errors:value.stats?.errors || 0
    }
  });
}
