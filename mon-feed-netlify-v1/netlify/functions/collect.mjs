import { collectAll } from '../lib/collector.mjs';

export default async () => {
  const start = Date.now();
  try {
    const feed = await collectAll();
    console.log(JSON.stringify({ event:'mon-feed-collect', ok:true, durationMs:Date.now()-start, stats:feed.stats, generatedAt:feed.generatedAt }));
    return new Response(null, { status:204 });
  } catch (error) {
    console.error(JSON.stringify({ event:'mon-feed-collect', ok:false, durationMs:Date.now()-start, error:error?.message || String(error) }));
    throw error;
  }
};

export const config = { schedule:'*/10 * * * *' };
