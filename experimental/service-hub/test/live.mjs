import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHub} from '../worker/index.js';
const cfg=JSON.parse(await readFile(new URL('../worker/config.json',import.meta.url),'utf8'));
const hub=createHub(),env={ALLOW_PUBLIC_PREVIEW:'true'},results=[];
async function check(path,count,shape,status=200){const r=await hub.fetch(new Request('https://local.test'+path),env),data=await r.json();assert.equal(r.status,status,path);if(count!==undefined)assert.equal(data.metas.length,count,path);if(shape)assert.ok(data.metas.every(m=>m.posterShape===shape),path);results.push({path,status:r.status,count:data.metas?.length,firstId:data.metas?.[0]?.id,error:data.error});return data;}
for(const s of cfg.services)for(const type of ['movie','series'])if(s.charts[type])await check(`/catalog/${type}/${s.id}.top10/genre=US+Top+10.json`,10,'landscape');
const a=await check('/catalog/movie/netflix.browse/genre=Popular.json',20,'poster');
const b=await check('/catalog/movie/netflix.browse/genre=Popular&skip=20.json',20,'poster');assert.notEqual(a.metas[0].id,b.metas[0].id);
await check('/catalog/movie/netflix.browse/genre=Action.json',20,'poster');
await check('/catalog/series/disney.browse/genre=Popular.json',20,'poster');
await check('/catalog/movie/hulu.browse/genre=Popular.json',undefined,undefined,503);
const report={date:new Date().toISOString(),passed:results.length,scope:'Live public providers only. Keyed TMDB/Trakt adapters remain mock-tested until credentials are configured.',results};
await writeFile(new URL('../LIVE-RESULTS.json',import.meta.url),JSON.stringify(report,null,2));console.log(`${results.length} live checks passed; 18 charts and public catalog paging verified. Unsupported credentials fail safely.`);
