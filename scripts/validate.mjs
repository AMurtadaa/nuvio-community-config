import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const collections=await read('config/collections.template.json');
assert.equal(collections.length,20);
assert.equal(collections.flatMap(c=>c.folders).length,918);
assert.equal(collections.flatMap(c=>c.folders.flatMap(f=>f.sources)).length,3612);
const ids=new Set();
for(const c of collections){assert.equal(c.pinToTop,false);for(const f of c.folders){assert.ok(!ids.has(f.id));ids.add(f.id);assert.deepEqual(f.sources,f.catalogSources);}}
const services=collections.find(c=>c.title==='Streaming Services');
assert.equal(services.folders.length,22);assert.ok(services.folders.every(f=>f.focusGifEnabled));
const recipe=await read('config/topx-us-landscape.json');
assert.equal(recipe.catalogs.length,20);assert.ok(recipe.catalogs.every(c=>c.shape==='landscape'));
const home=await read('config/home.template.json');
assert.deepEqual(home.items.filter(i=>i.enabled).slice(0,3).map(i=>i.catalog_id||i.custom_title),['jw.us.topx.movie','jw.us.topx.series','Streaming Services']);
const tv=(await read('config/tv-appearance.json')).tv.features.layout_settings;
assert.equal(tv.selected_layout.value,'MODERN');assert.equal(tv.hero_section_enabled.value,true);
// Scan tracked source candidates, never private exports or generated user presets.
const ignored=new Set(['.git','node_modules','generated','private','dist']);
let files=0;
async function scan(dir=root){for(const e of await readdir(dir,{withFileTypes:true})){
 if(ignored.has(e.name))continue;const url=new URL(e.name+(e.isDirectory()?'/':''),dir);
 if(e.isDirectory()){await scan(url);continue;}
 if(e.name==='index.js'&&fileURLToPath(url).includes('service-hub'))continue;
 assert.ok(!e.name.startsWith('.env')||e.name==='.env.example','Private environment file');
 const s=await readFile(url,'utf8');files++;
 const forbidden=[/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{30,}/,/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/];
 assert.ok(forbidden.every(rx=>!rx.test(s)),'Credential signature found in '+fileURLToPath(url));
 if(e.name.endsWith('.json')){
  JSON.parse(s);
  if(url.href.includes('/config/')){
   assert.ok(!/"(?:password|access_token|refresh_token|api_key|authorization|email|watch_history)"\s*:/i.test(s),'Private JSON field');
   assert.ok(!/"(?:addons|player_settings|debrid_settings|trakt_settings)"\s*:/i.test(s),'Account settings in public template');
  }
 }
}}
await scan();console.log(`Validated templates, Home ordering, TV/GIF regression guards and ${files} public source files. Signature checks supplement manual URL review; they are not a universal secret detector.`);
