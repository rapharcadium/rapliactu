import assert from 'node:assert/strict';
import { cleanText, decodeHtmlEntities } from '../netlify/lib/http.mjs';
assert.equal(cleanText('d&#039;un agresseur'), "d'un agresseur");
assert.equal(cleanText('d&amp;#039;un agresseur'), "d'un agresseur");
assert.equal(cleanText('Rock &amp; Roll &quot;Live&quot;'), 'Rock & Roll "Live"');
assert.equal(cleanText('A&#x27;B &#8217; C&nbsp;D'), "A'B ’ C D");
assert.equal(decodeHtmlEntities('&laquo;Salut&raquo; &hellip;'), '«Salut» …');
console.log('entities: OK');
