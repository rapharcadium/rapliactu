import { getStore } from '@netlify/blobs';

export default async (request) => {
  const store = getStore('mon-feed');
  const feed = await store.get('feed/current', { type:'json', consistency:'strong' });
  if (!feed) {
    return Response.json({
      version:'1.0.0', generatedAt:null,
      stats:{sources:0,ok:0,stale:0,errors:0,disabled:0,articles:0},
      sources:[], articles:[],
      message:'Aucune collecte disponible. Lance la fonction collect une première fois depuis Netlify.'
    }, { status:200, headers:{ 'cache-control':'no-store' } });
  }
  const etag = `W/\"${feed.generatedAt || 'empty'}-${feed.stats?.articles || 0}\"`;
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status:304, headers:{etag} });
  return Response.json(feed, {
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'public, max-age=45, stale-while-revalidate=300',
      'etag':etag,
      'x-mon-feed-generated-at':feed.generatedAt || ''
    }
  });
};

export const config = { path:'/api/feed' };
