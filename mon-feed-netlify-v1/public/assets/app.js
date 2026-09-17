const CATEGORY_LABELS={all:'Tout',football:'⚽ Foot',basket:'🏀 Basket',nfl:'🏈 NFL',baseball:'⚾ MLB',local:'📍 Local',transport:'🚛 Transport',metal:'🤘 Metal',cards:'🃏 Cards'};
let payload={articles:[],sources:[],stats:{}};
let state={category:'all',source:'all',read:'all',sort:'new',search:'',favOnly:false};
const readSet=new Set(JSON.parse(localStorage.getItem('mf_v1_read')||'[]'));
const favSet=new Set(JSON.parse(localStorage.getItem('mf_v1_fav')||'[]'));
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

function age(iso){if(!iso)return 'heure inconnue';const d=new Date(iso),m=Math.max(0,Math.floor((Date.now()-d)/60000));if(m<1)return "à l’instant";if(m<60)return `il y a ${m} min`;const h=Math.floor(m/60);if(h<24)return `il y a ${h} h`;const j=Math.floor(h/24);if(j<7)return `il y a ${j} j`;return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}
function freshness(iso){if(!iso)return 'Aucune collecte disponible';const d=new Date(iso);return `Collecté ${age(iso)} • ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`}
function persist(){localStorage.setItem('mf_v1_read',JSON.stringify([...readSet]));localStorage.setItem('mf_v1_fav',JSON.stringify([...favSet]))}

function buildFilters(){
  const cats=['all',...new Set(payload.sources.map(s=>s.category).filter(Boolean))];
  $('categories').innerHTML=cats.map(c=>`<button class="chip ${state.category===c?'active':''}" data-cat="${c}">${esc(CATEGORY_LABELS[c]||c)}</button>`).join('')+`<button class="chip ${state.favOnly?'active':''}" id="favOnly">⭐ Favoris</button>`;
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{state.category=b.dataset.cat;state.favOnly=false;buildFilters();render()});
  $('favOnly').onclick=()=>{state.favOnly=!state.favOnly;if(state.favOnly)state.category='all';buildFilters();render()};
  const current=state.source;
  $('sourceFilter').innerHTML='<option value="all">Toutes les sources</option>'+payload.sources.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
  $('sourceFilter').value=payload.sources.some(s=>s.id===current)?current:'all';
}

function filtered(){
  let a=[...payload.articles];
  if(state.category!=='all')a=a.filter(x=>x.category===state.category);
  if(state.source!=='all')a=a.filter(x=>x.sourceId===state.source);
  if(state.favOnly)a=a.filter(x=>favSet.has(x.id));
  if(state.read==='read')a=a.filter(x=>readSet.has(x.id));
  if(state.read==='unread')a=a.filter(x=>!readSet.has(x.id));
  if(state.search){const q=state.search.toLowerCase();a=a.filter(x=>`${x.title} ${x.originalTitle} ${x.summary} ${x.source}`.toLowerCase().includes(q))}
  if(state.sort==='clickbait')a.sort((a,b)=>(b.clickbaitScore||0)-(a.clickbaitScore||0));
  else if(state.sort==='source')a.sort((a,b)=>a.source.localeCompare(b.source,'fr')||(Date.parse(b.publishedAt||0)-Date.parse(a.publishedAt||0)));
  else a.sort((a,b)=>Date.parse(b.publishedAt||0)-Date.parse(a.publishedAt||0));
  return a;
}

function render(){
  const items=filtered();$('count').textContent=`${items.length} article${items.length>1?'s':''}`;
  $('statAll').textContent=payload.articles.length;$('statUnread').textContent=payload.articles.filter(x=>!readSet.has(x.id)).length;$('statFav').textContent=favSet.size;
  if(!items.length){$('feed').innerHTML=`<div class="empty">Aucune actualité avec ces filtres.</div>`;return}
  $('feed').innerHTML=items.map(x=>{
    const rewritten=x.title&&x.originalTitle&&x.title!==x.originalTitle;
    return `<article class="card ${readSet.has(x.id)?'read':''}" data-id="${x.id}">
      <div class="meta"><div class="source-line"><span class="badge" style="border-color:${esc(x.color||'#313b48')}55">${esc(x.icon||'📰')} ${esc(x.source)}</span><span>${esc(CATEGORY_LABELS[x.category]||x.category)}</span></div><span class="age">${esc(age(x.publishedAt))}</span></div>
      <h3 class="title"><a href="${esc(x.link)}" target="_blank" rel="noopener" data-open="${x.id}">${esc(x.title||x.originalTitle)}</a></h3>
      ${rewritten?`<div class="original">Original : ${esc(x.originalTitle)}</div>`:''}
      ${x.summary?`<p class="summary">${esc(x.summary)}</p>`:''}
      <div class="actions"><button class="mini ${favSet.has(x.id)?'on':''}" data-fav="${x.id}">⭐</button><button class="mini" data-read="${x.id}">${readSet.has(x.id)?'↩ Non lu':'✓ Lu'}</button><a class="mini" href="${esc(x.link)}" target="_blank" rel="noopener" data-open="${x.id}">Lire ↗</a>${x.clickbaitScore>=40?`<span class="clickbait">🎣 ${x.clickbaitScore}/100</span>`:''}</div>
    </article>`
  }).join('');
  document.querySelectorAll('[data-fav]').forEach(b=>b.onclick=()=>{favSet.has(b.dataset.fav)?favSet.delete(b.dataset.fav):favSet.add(b.dataset.fav);persist();render()});
  document.querySelectorAll('[data-read]').forEach(b=>b.onclick=()=>{readSet.has(b.dataset.read)?readSet.delete(b.dataset.read):readSet.add(b.dataset.read);persist();render()});
  document.querySelectorAll('[data-open]').forEach(a=>a.onclick=()=>{readSet.add(a.dataset.open);persist();setTimeout(render,150)});
}

function renderSources(){
  const s=payload.sources||[];
  const ok=s.filter(x=>x.status==='ok').length, stale=s.filter(x=>x.status==='stale').length, err=s.filter(x=>x.status==='error').length;
  $('sourceSummary').textContent=`${ok} OK${stale?` • ${stale} cache`:''}${err?` • ${err} erreur`:''}`;
  $('sources').innerHTML=s.map(x=>`<div class="source-row"><span>${esc(x.icon||'📰')}</span><div><div class="source-name">${esc(x.name)}</div><div class="source-detail">${esc(x.mode||'—')} • ${x.count||0} actus${x.lastSuccessAt?` • ${age(x.lastSuccessAt)}`:''}</div></div><span class="status ${esc(x.status)}">${esc(x.status)}</span></div>`).join('');
}

async function load(){
  $('liveDot').className='dot loading';
  try{
    const r=await fetch('/api/feed',{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);payload=await r.json();
    $('freshness').textContent=freshness(payload.generatedAt);$('liveDot').className='dot';buildFilters();renderSources();render();
  }catch(e){$('liveDot').className='dot error';$('freshness').textContent='Feed indisponible';$('feed').innerHTML=`<div class="empty">Impossible de lire le feed : ${esc(e.message)}</div>`}
}

$('refresh').onclick=load;$('search').oninput=e=>{state.search=e.target.value.trim();render()};$('sourceFilter').onchange=e=>{state.source=e.target.value;render()};$('readFilter').onchange=e=>{state.read=e.target.value;render()};$('sort').onchange=e=>{state.sort=e.target.value;render()};
load();setInterval(load,5*60*1000);
