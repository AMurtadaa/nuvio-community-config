import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const cols=await read('config/collections.template.json');assert.equal(cols.length,19);assert.equal(cols.flatMap(c=>c.folders).length,786);assert.equal(cols.flatMap(c=>c.folders.flatMap(f=>f.sources)).length,3612);
const ids=new Set();for(const c of cols){assert.notEqual(c.title,'More Browsing');for(const f of c.folders){assert.ok(!ids.has(f.id));ids.add(f.id);assert.deepEqual(f.catalogSources,f.sources.filter(s=>s.provider==='addon').map(s=>({type:s.type,addonId:s.addonId,catalogId:s.catalogId})));}}
const services=cols.find(c=>c.title==='Streaming Services');assert.equal(services.folders.length,22);assert.equal(services.folders.flatMap(f=>f.sources).length,741);assert.ok(services.folders.every(f=>f.focusGifEnabled));
const ignored=new Set(['generated','private','.git','node_modules']);let files=0;
async function scan(dir=root){for(const e of await readdir(dir,{withFileTypes:true})){if(ignored.has(e.name))continue;const url=new URL(e.name+(e.isDirectory()?'/':''),dir);if(e.isDirectory()){assert.ok(!['addons','experimental','secrets'].includes(e.name),'Hosted package in simple branch');await scan(url);continue;}files++;const s=await readFile(url,'utf8');assert.ok(!/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(s),'Possible secret in '+fileURLToPath(url));if(e.name.endsWith('.json'))JSON.parse(s);if(url.href.includes('/config/'))assert.ok(!s.includes('community.nuvio.serviceshelves.us'),'Hosted reference in config');}}
await scan();console.log('Validated '+files+' public files: 19 collections, 786 folders, 3612 native/direct sources; no More Browsing or hosted addon references.');
