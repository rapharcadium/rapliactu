/*
 * Rapli Actu — Anti‑Putaclic V2
 * --------------------------------
 * Objectif : rendre les titres plus informatifs sans inventer de faits.
 *
 * 1) Analyse rapide au moment de la collecte (titre + résumé).
 * 2) Nouvelle analyse après enrichissement avec le texte de l'article.
 * 3) Une réécriture n'est appliquée que si elle est directement supportée
 *    par les informations disponibles. À défaut : neutralisation prudente.
 */

const PERSON_PLACEHOLDER = /\b(ce joueur|cette joueuse|ce footballeur|cette footballeuse|cette star|ce crack|cet attaquant|cette attaquante|ce milieu|ce défenseur|ce gardien|cette pépite|un cadre|une star|ce français|cette française|ce basketteur|cette basketteuse|ce quarterback|ce receveur|ce pilote|ce cycliste)\b/i;

const HIDDEN_INFO = /\b(ce qui(?: ne)?|ce que|ce qu['’]|la raison|les raisons|voici pourquoi|pourquoi|ce détail|cet élément|ce point|ce problème|cette décision|ce choix|son constat|son verdict|sa réponse|ses vérités|ce qui ne tourne pas rond)\b/i;

const SENSATIONAL = /\b(coup de tonnerre|énorme|incroyable|choc|alerte|surprise|hallucinant|dingue|séisme|catastrophe|scandale|ça chauffe|fait trembler|terrible nouvelle|grosse bombe|bombe|folle rumeur)\b/i;
const TEASE = /\b(voici|découvrez|on sait pourquoi|ce qu['’]il faut savoir|tout savoir|vous ne devinerez|révélé|révèle tout|lâche ses vérités|sort du silence)\b/i;
const CONDITIONAL = /\b(pourrait|serait|aurait|devrait|envisagerait|songerait|selon|possible|rumeur)\b/i;
const REPORTING = /\b(pointe(?: du doigt)?|pointé(?: du doigt)?|désigne|désigné|déplore|déploré|regrette|regretté|critique|critiqué|explique|expliqué|estime|estimé|reproche|reproché|souligne|souligné|évoque|évoqué|insiste sur|a insisté sur|met en cause|a mis en cause|reconnaît|a reconnu)\b/i;
const CLAIM_WORDS = /\b(manque|problème|difficulté|déficit|faiblesse|erreur|erreurs|maîtrise|agressivité|efficacité|intensité|concentration|mental|physique|défense|attaque|pressing|rythme|discipline|fatigue|blessure|organisation|collectif|individuel|niveau|attitude|engagement|réalisme|précision|déchet|naïveté)\b/i;

const KNOWN = [
  'Ousmane Dembélé','Kylian Mbappé','Sakina Karchaoui','Wendie Renard','Marie-Antoinette Katoto','Kadidiatou Diani','Rayan Cherki','Bruno Guimarães','Victor Wembanyama','Antoine Griezmann','Paul Pogba','Bradley Barcola','Aurélien Tchouaméni','William Saliba','Michael Olise','Alexander Isak','Joel Embiid','Rudy Gobert','Bilal Coulibaly','Nicolas Batum','Marine Johannès','Gabby Williams','Dominique Malonga','Patrick Mahomes','Josh Allen','Lamar Jackson','Justin Jefferson','Bruno Genesio'
];

const ENTITY_BLACKLIST = /^(Premier League|Ligue 1|Ligue des Champions|Coupe de France|Équipe de France|Equipe de France|Real Madrid|FC Barcelone|Paris Saint-Germain|Manchester United|Manchester City|Olympique de Marseille|Olympique Lyonnais|Le Havre|New York|Los Angeles|Golden State|San Antonio|Foot Mercato|Radio Metal|Le Monde)$/i;

function cleanSpace(s='') { return String(s).replace(/\s+/g,' ').trim(); }
function tidy(s='') {
  return cleanSpace(s)
    .replace(/^[\s,:;.!?–—-]+|[\s,:;.!?–—-]+$/g,'')
    .replace(/\s+([,.;!?])/g,'$1');
}
function cap(s='') { const x=tidy(s); return x ? x[0].toUpperCase()+x.slice(1) : x; }
function truncate(s='', max=125) {
  const x=tidy(s);
  if (x.length <= max) return x;
  const cut=x.slice(0,max+1).replace(/\s+\S*$/,'');
  return `${cut}…`;
}
function unresolvedVagueness(s='') { return PERSON_PLACEHOLDER.test(s) || HIDDEN_INFO.test(s); }

function scoreTitle(title='') {
  let score=0; const reasons=[];
  if (PERSON_PLACEHOLDER.test(title)) { score+=55; reasons.push('personne masquée'); }
  if (HIDDEN_INFO.test(title)) { score+=43; reasons.push('information masquée'); }
  if (SENSATIONAL.test(title)) { score+=20; reasons.push('formulation sensationnaliste'); }
  if (TEASE.test(title)) { score+=14; reasons.push('incitation au clic'); }
  if (CONDITIONAL.test(title)) { score+=6; reasons.push('conditionnel'); }
  if (/[!?]{2,}/.test(title)) { score+=8; reasons.push('ponctuation emphatique'); }
  return {score:Math.min(100,score),reasons};
}

function candidatePeople(text='') {
  const exact=KNOWN.filter(name=>text.toLowerCase().includes(name.toLowerCase())).map(name=>({name,confidence:96}));
  const dynamic=(text.match(/\b[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’.-]{2,}(?:\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’.-]{2,}){1,2}\b/g)||[])
    .filter(x=>!ENTITY_BLACKLIST.test(x) && x.length<45)
    .map(name=>({name,confidence:70}));
  const seen=new Set(); return [...exact,...dynamic].filter(x=>{const k=x.name.toLowerCase(); if(seen.has(k))return false;seen.add(k);return true});
}

function personFromContext(context='',title='') {
  const inTitle=candidatePeople(title).find(x=>!ENTITY_BLACKLIST.test(x.name));
  if (inTitle) return {...inTitle,confidence:Math.max(90,inTitle.confidence)};
  const list=candidatePeople(context);
  return list[0]||{name:null,confidence:0};
}

function extractSubjectFromTitle(title='') {
  const cleaned=title.replace(/^\s*(?:un|une)\s+/i,'');
  const matches=cleaned.match(/\b[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’.-]{2,}(?:\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’.-]{2,}){1,2}\b/g)||[];
  return matches.find(x=>!ENTITY_BLACKLIST.test(x) && x.length<45)||null;
}

function extractTarget(title='') {
  const m=title.match(/\b(?:à|au|aux|chez|du côté de)\s+((?:l['’]|le\s+|la\s+|les\s+)?(?:OM|OL|PSG|HAC|FFF|NBA|[A-Z][A-Za-zÀ-ÿ0-9.'’ -]{1,35}))(?=\s*[!?.,:;–—-]*$|\s+(?:après|avant|pour|sur)\b)/i);
  if (!m) return null;
  return tidy(m[1]);
}

function deTarget(target='') {
  const t=tidy(target);
  if(!t)return '';
  if(/^l['’]/i.test(t))return `de ${t}`;
  if(/^le\s+/i.test(t))return `du ${t.replace(/^le\s+/i,'')}`;
  if(/^la\s+/i.test(t))return `de la ${t.replace(/^la\s+/i,'')}`;
  if(/^les\s+/i.test(t))return `des ${t.replace(/^les\s+/i,'')}`;
  return `de ${t}`;
}

function sentences(text='') {
  return cleanSpace(text)
    .replace(/([.!?])\s+(?=[A-ZÀ-Ÿ«“])/g,'$1\n')
    .split(/\n+/)
    .map(tidy)
    .filter(s=>s.length>=20 && s.length<=500);
}

function normalizeClaim(raw='') {
  let c=tidy(raw)
    .replace(/^[«“"']+|[»”"']+$/g,'')
    .replace(/^(?:que|selon lui|selon elle)\s+/i,'')
    .replace(/\s+(?:a-t-il|a-t-elle|explique-t-il|explique-t-elle|ajoute-t-il|ajoute-t-elle).*$/i,'');
  // Transformer des citations courantes en syntagme nominal exploitable.
  c=c.replace(/^(?:on|nous)\s+(?:manque|manquons)\s+de\s+/i,'un manque de ')
     .replace(/^il\s+nous\s+manque\s+/i,'un manque de ')
     .replace(/^(?:on|nous)\s+(?:a|avons)\s+manqué\s+de\s+/i,'un manque de ')
     .replace(/^(?:on|nous)\s+(?:n['’]a|n['’]avons)\s+pas\s+assez\s+de\s+/i,'un manque de ');
  c=c.split(/\s+[–—-]\s+|;|\.(?:\s|$)/)[0];
  if (/^(je|j['’]|nous|on)\b/i.test(c) && !/^un manque de\b/i.test(c)) return '';
  if (unresolvedVagueness(c) || c.length<10) return '';
  return truncate(c,100);
}

function claimFromContext(context='',subject='') {
  const ss=sentences(context); if(!ss.length)return null;
  const last=(subject||'').split(/\s+/).pop();
  const ranked=ss.map(sentence=>{
    let points=0;
    if(last && new RegExp(`\\b${last.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(sentence))points+=4;
    if(REPORTING.test(sentence))points+=5;
    if(CLAIM_WORDS.test(sentence))points+=4;
    if(/[«“"][^»”"]{12,180}[»”"]/.test(sentence))points+=3;
    if(HIDDEN_INFO.test(sentence))points-=3;
    return {sentence,points};
  }).filter(x=>x.points>=7).sort((a,b)=>b.points-a.points);
  for(const {sentence} of ranked.slice(0,6)){
    // 1) Complément après un verbe de constat/critique.
    const verb=sentence.match(/(?:pointe(?: du doigt)?|pointé(?: du doigt)?|déplore|déploré|regrette|regretté|critique|critiqué|reproche|reproché|souligne|souligné|évoque|évoqué|insiste sur|a insisté sur|met en cause|a mis en cause)\s+(?:notamment\s+|surtout\s+)?(.{10,180})/i);
    if(verb){const c=normalizeClaim(verb[1]); if(c && CLAIM_WORDS.test(c))return {claim:c,confidence:94,evidence:sentence};}
    // 2) Citation utile : privilégier une formulation contenant un terme concret.
    const quotes=[...(sentence.matchAll(/[«“"]([^»”"]{12,180})[»”"]/g))].map(m=>m[1]);
    for(const q of quotes){const c=normalizeClaim(q);if(c&&CLAIM_WORDS.test(c))return{claim:c,confidence:90,evidence:sentence};}
    // 3) « manque de X » / « problème de X » dans la phrase.
    const noun=sentence.match(/\b(un manque de|le manque de|des problèmes? de|un problème de|un déficit de|trop de|pas assez de)\s+([^,.;:!?]{3,90})/i);
    if(noun){const c=normalizeClaim(`${noun[1]} ${noun[2]}`);if(c)return{claim:c,confidence:88,evidence:sentence};}
  }
  return null;
}

function eventFromContext(context='',target='') {
  const ss=sentences(context).slice(0,8);
  for(const s of ss){
    const m=s.match(/\b(?:après|à la suite de)\s+([^.;!?]{8,100})/i); if(m)return truncate(m[1],80);
    if(target){
      const escaped=target.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const away=s.match(new RegExp(`(?:sur la pelouse de|face à|contre)\\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ0-9.'’ -]{2,35})`,'i'));
      if(away)return `le match contre ${tidy(away[1])}`;
      if(new RegExp(escaped,'i').test(s) && /défaite|battu|perdu|effondr/i.test(s))return 'la rencontre';
    }
  }
  return null;
}

function neutralizeHidden(title,context) {
  const subject=extractSubjectFromTitle(title)||personFromContext(context,title).name;
  const target=extractTarget(title);
  if(!subject)return null;
  const lower=title.toLowerCase();
  if(/ce qui ne tourne pas rond|ce qui ne va pas|ce qui cloche/.test(lower)){
    const event=eventFromContext(context,target);
    if(event)return {title:`${subject} réagit après ${event}`,confidence:74,mode:'neutralized'};
    if(target)return {title:`${subject} évoque les difficultés ${deTarget(target)}`,confidence:72,mode:'neutralized'};
    return {title:`${subject} évoque les difficultés rencontrées`,confidence:70,mode:'neutralized'};
  }
  if(/désigne ce qui|explique ce qui|révèle ce qui|dit ce qui/.test(lower)){
    if(target)return {title:`${subject} s’exprime sur la situation ${deTarget(target)}`,confidence:68,mode:'neutralized'};
  }
  if(/la raison|voici pourquoi|pourquoi/.test(lower)){
    if(target)return {title:`${subject} : les explications concernant ${target}`,confidence:66,mode:'neutralized'};
    return {title:`${subject} donne ses explications`,confidence:64,mode:'neutralized'};
  }
  return null;
}

function stripSensational(title='') {
  let t=title
    .replace(/^\s*(?:coup de tonnerre|alerte|incroyable|énorme surprise|choc)\s*[:!–—-]*\s*/i,'')
    .replace(/\s*!{2,}\s*$/,'!');
  return tidy(t);
}

export function analyzeTitle(title='', summary='', bodyText='') {
  const originalTitle=tidy(title); const context=cleanSpace(`${summary||''} ${bodyText||''}`);
  const {score,reasons}=scoreTitle(originalTitle);
  let cleanTitle=originalTitle,entity=null,confidence=0,rewriteMode='none',evidence='';

  // A. « ce joueur / cette star… » : remplacement uniquement par une personne clairement identifiée.
  if(PERSON_PLACEHOLDER.test(cleanTitle)){
    const found=personFromContext(context,originalTitle);entity=found.name;confidence=found.confidence;
    if(entity && confidence>=90){
      cleanTitle=cleanTitle.replace(PERSON_PLACEHOLDER,entity);
      rewriteMode='entity-reveal';
    }
  }

  // B. Information volontairement cachée (« ce qui ne tourne pas rond », « la raison », etc.).
  if(HIDDEN_INFO.test(cleanTitle)){
    const subject=extractSubjectFromTitle(cleanTitle)||entity||personFromContext(context,cleanTitle).name;
    const found=claimFromContext(context,subject);
    if(found && subject){
      const target=extractTarget(cleanTitle);
      cleanTitle=`${subject} pointe ${found.claim}${target && !new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(found.claim) ? ` ${deTarget(target)}` : ''}`;
      confidence=found.confidence;rewriteMode='fact-reveal';evidence=found.evidence;
    } else {
      const neutral=neutralizeHidden(cleanTitle,context);
      if(neutral){cleanTitle=neutral.title;confidence=Math.max(confidence,neutral.confidence);rewriteMode=neutral.mode;}
    }
  }

  // C. Retirer l'accroche sensationnaliste si elle n'apporte aucune information.
  if(SENSATIONAL.test(cleanTitle)){
    const stripped=stripSensational(cleanTitle);
    if(stripped && stripped.length>=12 && stripped!==cleanTitle){cleanTitle=stripped;confidence=Math.max(confidence,62);if(rewriteMode==='none')rewriteMode='dehyped';}
  }

  // Garde-fous : jamais de titre plus vague qu'au départ, ni de réécriture vide / gigantesque.
  cleanTitle=cap(truncate(cleanTitle,145));
  if(!cleanTitle || cleanTitle.length<8 || (unresolvedVagueness(cleanTitle)&&!unresolvedVagueness(originalTitle))){cleanTitle=originalTitle;rewriteMode='none';confidence=0;evidence='';}

  const rewritten=cleanTitle!==originalTitle;
  return {
    clickbaitScore:score,
    clickbaitReasons:reasons,
    cleanTitle,
    entity,
    confidence:rewritten?confidence:0,
    rewriteMode:rewritten?rewriteMode:'none',
    rewritten,
    evidence:rewritten?evidence:''
  };
}
