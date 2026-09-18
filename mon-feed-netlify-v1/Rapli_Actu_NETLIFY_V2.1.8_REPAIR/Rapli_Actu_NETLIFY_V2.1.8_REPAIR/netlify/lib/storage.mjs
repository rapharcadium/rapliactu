import { getStore } from '@netlify/blobs';
import { HISTORY_DAYS } from './sources.mjs';

const STORE='rapli-actu';
export const CURRENT_KEY='feed/current';
export const SEEN_KEY='index/seen';
export const QUEUE_KEY='queue/enrich';
export const HISTORY_PREFIX='history/day/';

export function store(){return getStore(STORE)}
export async function getJSON(key,fallback=null){try{const v=await store().get(key,{type:'json',consistency:'strong'});return v??fallback}catch{return fallback}}
export async function setJSON(key,value,metadata={}){return store().setJSON(key,value,{metadata})}
export async function readCurrent(){return getJSON(CURRENT_KEY,null)}
export async function writeCurrent(value){return setJSON(CURRENT_KEY,value,{generatedAt:value.generatedAt||new Date().toISOString(),articles:value.stats?.articles||0,ok:value.stats?.ok||0,stale:value.stats?.stale||0,errors:value.stats?.errors||0})}
export async function readSeen(){return getJSON(SEEN_KEY,{})}
export async function writeSeen(value){return setJSON(SEEN_KEY,value,{count:Object.keys(value||{}).length,updatedAt:new Date().toISOString()})}
export function dayKey(day){return `${HISTORY_PREFIX}${day}`}
export function isoDay(value=new Date()){const d=value instanceof Date?value:new Date(value);return Number.isNaN(d.getTime())?new Date().toISOString().slice(0,10):d.toISOString().slice(0,10)}
export async function readDay(day){return getJSON(dayKey(day),[])}
export async function writeDay(day,items){return setJSON(dayKey(day),items,{day,count:items.length,updatedAt:new Date().toISOString()})}
export async function readQueue(){return getJSON(QUEUE_KEY,[])}
export async function writeQueue(items){return setJSON(QUEUE_KEY,items.slice(0,500),{count:Math.min(items.length,500),updatedAt:new Date().toISOString()})}

export async function appendToArchive(newItems=[]){
  const groups=new Map();
  for(const item of newItems){const day=isoDay(item.discoveredAt||new Date());if(!groups.has(day))groups.set(day,[]);groups.get(day).push(item)}
  for(const [day,items] of groups){
    const previous=await readDay(day);const map=new Map(previous.map(x=>[x.id,x]));for(const item of items)map.set(item.id,item);
    const merged=[...map.values()].sort((a,b)=>Date.parse(b.publishedAt||b.discoveredAt||0)-Date.parse(a.publishedAt||a.discoveredAt||0));
    await writeDay(day,merged);
  }
}

export async function updateArchivedArticle(article){
  const day=isoDay(article.discoveredAt||article.publishedAt||new Date());const items=await readDay(day);let changed=false;
  const updated=items.map(x=>{if(x.id!==article.id)return x;changed=true;return {...x,...article}});
  if(changed)await writeDay(day,updated);
}

export async function pruneHistory(){
  const cutoff=new Date(Date.now()-HISTORY_DAYS*86400000);cutoff.setUTCHours(0,0,0,0);
  const listing=await store().list({prefix:HISTORY_PREFIX});let deleted=0;
  for(const b of listing.blobs||[]){const day=b.key.slice(HISTORY_PREFIX.length, HISTORY_PREFIX.length+10);const d=new Date(`${day}T00:00:00Z`);if(!Number.isNaN(d.getTime())&&d<cutoff){await store().delete(b.key);deleted++}}
  return deleted;
}

export function daysBetween(startIso,end=new Date()){
  const start=new Date(startIso);const finish=end instanceof Date?end:new Date(end);if(Number.isNaN(start.getTime()))return[];
  start.setUTCHours(0,0,0,0);finish.setUTCHours(0,0,0,0);const min=new Date(Date.now()-HISTORY_DAYS*86400000);min.setUTCHours(0,0,0,0);if(start<min)start.setTime(min.getTime());
  const out=[];for(let d=new Date(start);d<=finish;d.setUTCDate(d.getUTCDate()+1))out.push(d.toISOString().slice(0,10));return out;
}
