import assert from 'node:assert/strict';
import { parseLeMarin } from '../netlify/lib/parsers.mjs';
const source={page:'https://lemarin.ouest-france.fr/',domain:'lemarin.ouest-france.fr'};
const html=`<!doctype html><html><body>
<nav><a href="https://lemarin.ouest-france.fr/shipping">Shipping</a></nav>
<section class="card"><time datetime="2026-09-18T07:30:00+02:00"></time><h2><a href="https://lemarin.ouest-france.fr/shipping/un-vrai-article-maritime-12345678-1234-1234-1234-123456789abc">Un vrai article maritime publié ce matin</a></h2><p>Résumé utile.</p></section>
<section><h2><a href="https://lemarin.ouest-france.fr/peche/autre-vrai-article-87654321-4321-4321-4321-cba987654321">Autre vrai article sans date</a></h2></section>
<a href="https://lemarin.ouest-france.fr/abonnement/offre-premium-super-longue">Abonnement premium à notre journal</a>
</body></html>`;
const items=parseLeMarin(html,source);
assert.equal(items.length,1);
assert.equal(items[0].title,'Un vrai article maritime publié ce matin');
assert.match(items[0].link,/shipping\/un-vrai-article/);
assert.ok(items[0].publishedAt);
console.log('Le Marin parser OK');
