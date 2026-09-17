const VAGUE = /\b(ce joueur|cette joueuse|ce footballeur|cette footballeuse|cette star|ce crack|cet attaquant|cette attaquante|ce milieu|ce défenseur|ce gardien|cette pépite|un cadre|une star|ce français|cette française|ce basketteur|cette basketteuse|ce quarterback|ce receveur)\b/i;
const SENSATIONAL = /coup de tonnerre|énorme|incroyable|choc|alerte|surprise|hallucinant|dingue|séisme|retournement|catastrophe|scandale|ça chauffe|fait trembler/i;
const TEASE = /voici|découvrez|on sait pourquoi|la raison|ce qu'il faut savoir|tout savoir|vous ne devinerez|révélé/i;
const CONDITIONAL = /pourrait|serait|aurait|devrait|envisagerait|songerait|selon|possible|rumeur/i;

const KNOWN = [
  'Ousmane Dembélé','Kylian Mbappé','Sakina Karchaoui','Wendie Renard','Marie-Antoinette Katoto','Kadidiatou Diani','Rayan Cherki','Bruno Guimarães','Victor Wembanyama','Antoine Griezmann','Paul Pogba','Bradley Barcola','Aurélien Tchouaméni','William Saliba','Michael Olise','Alexander Isak','Joel Embiid','Rudy Gobert','Bilal Coulibaly','Nicolas Batum','Marine Johannès','Gabby Williams','Dominique Malonga','Patrick Mahomes','Josh Allen','Lamar Jackson','Justin Jefferson'
];

function score(title='') {
  let s = 0;
  if (VAGUE.test(title)) s += 55;
  if (SENSATIONAL.test(title)) s += 23;
  if (CONDITIONAL.test(title)) s += 9;
  if (TEASE.test(title)) s += 15;
  if (/[!?]{2,}/.test(title)) s += 10;
  return Math.min(100, s);
}

function personFromSummary(summary='') {
  const exact = KNOWN.find(name => summary.toLowerCase().includes(name.toLowerCase()));
  if (exact) return { name: exact, confidence: 96 };
  const candidates = summary.match(/\b[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’.-]{2,}(?:\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’.-]{2,}){1,2}\b/g) || [];
  const bad = /^(Premier League|Ligue|Coupe|Équipe de France|Equipe de France|Real Madrid|FC Barcelone|Paris Saint-Germain|Manchester|Olympique|Le Havre|New York|Los Angeles|Golden State|San Antonio)/i;
  const found = candidates.find(x => !bad.test(x) && x.length < 42);
  return found ? { name: found, confidence: 62 } : { name:null, confidence:0 };
}

export function analyzeTitle(title='', summary='') {
  const clickbaitScore = score(title);
  let cleanTitle = title;
  let entity = null;
  let confidence = 0;
  if (VAGUE.test(title)) {
    const found = personFromSummary(summary);
    entity = found.name;
    confidence = found.confidence;
    // Réécriture uniquement si la confiance est forte. Sinon on conserve le titre original.
    if (entity && confidence >= 90) cleanTitle = title.replace(VAGUE, entity);
  }
  return { clickbaitScore, cleanTitle, entity, confidence };
}
