import assert from 'node:assert/strict';
import { isPlaceholderImageUrl, sanitizeImageUrl, suppressRepeatedImages } from '../netlify/lib/images.mjs';

assert.equal(isPlaceholderImageUrl('https://site.fr/images/placeholder.jpg'), true);
assert.equal(isPlaceholderImageUrl('https://site.fr/assets/no-image.png'), true);
assert.equal(isPlaceholderImageUrl('https://site.fr/default-social-share.jpg'), true);
assert.equal(isPlaceholderImageUrl('https://site.fr/favicon.svg'), true);
assert.equal(isPlaceholderImageUrl('https://site.fr/uploads/2026/09/match-hac-ol.jpg'), false);
assert.equal(sanitizeImageUrl('https://site.fr/placeholder.png'), '');
const rows = Array.from({length:4},(_,i)=>({id:String(i),sourceId:'x',image:'https://site.fr/static/share.jpg'}));
assert.equal(suppressRepeatedImages(rows).every(x=>x.image===''), true);
console.log('images: OK');
