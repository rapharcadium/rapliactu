import assert from 'node:assert/strict';
import { analyzeTitle } from '../netlify/lib/antiClickbait.mjs';

let r;
r=analyzeTitle("Ce joueur pourrait manquer 3 semaines","Ousmane Dembélé s'est blessé à la cheville et pourrait être absent trois semaines.");
assert.equal(r.cleanTitle,"Ousmane Dembélé pourrait manquer 3 semaines");
assert.equal(r.rewriteMode,'entity-reveal');

r=analyzeTitle("Un Bruno Genesio abattu désigne ce qui ne tourne pas rond à l’OM","L’OM s’est effondré en deuxième période sur la pelouse de Besiktas.","Bruno Genesio a pointé du doigt un manque de maîtrise dans les moments importants.");
assert.match(r.cleanTitle,/Bruno Genesio pointe un manque de maîtrise/i);
assert.equal(r.rewriteMode,'fact-reveal');

r=analyzeTitle("Un Bruno Genesio abattu désigne ce qui ne tourne pas rond à l’OM","L’OM s’est effondré en deuxième période sur la pelouse de Besiktas.","");
assert.ok(!/ce qui ne tourne pas rond/i.test(r.cleanTitle));
assert.equal(r.rewriteMode,'neutralized');

r=analyzeTitle("Le HAC s'impose 2-0 face à Nantes","Victoire du Havre.");
assert.equal(r.cleanTitle,"Le HAC s'impose 2-0 face à Nantes");
assert.equal(r.rewritten,false);

console.log('Anti‑Putaclic V2: tests OK');
