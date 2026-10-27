import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve,sep} from 'node:path';
import http from 'node:http';
import {buildUrl,NetflixCatalog,PageCache} from '../core.mjs';
import {createServer} from '../server.mjs';
const config=JSON.parse(await readFile(new URL('../feeds.json',import.meta.url),'utf8'));
const f=config.feeds.find(f=>f.name==='Popular'&&f.type==='movie')||config.feeds[0];
const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json'}});
const items=(start=1,n=20)=>Array.from({length:n},(_,i)=>({id:start+i,title:'Movie '+(start+i),poster_path:'/poster.jpg',vote_average:9,release_date:'2026-01-01'}));
const ready=(options={})=>{const c=new NetflixCatalog(config,options);c.token='unit-test-credential';c.authKind='token';return c;};

test('manifest preserves all 709 categories, with paging and no Home flood',()=>{
 const c=ready(),m=c.manifest();assert.equal(m.catalogs.length,709);assert.equal(new Set(m.catalogs.map(x=>x.id)).size,709);assert.deepEqual(m.resources,['catalog']);
 assert.ok(m.catalogs.every(x=>x.pageSize===8&&x.showInHome===false&&x.extra.some(e=>e.name==='skip')));
});
test('every saved source filter is mapped with correct region/provider and TV date names',()=>{
 for(const feed of config.feeds){const u=buildUrl(feed,2,config),s=feed.source;
  assert.equal(u.searchParams.get('page'),'2');assert.equal(u.searchParams.get('watch_region'),s.filters.withWatchProviders||s.filters.withoutWatchProviders?s.filters.watchRegion||'US':null);assert.equal(u.searchParams.get('with_watch_providers'),s.filters.withWatchProviders||null);
  if(s.filters.withoutGenres)assert.equal(u.searchParams.get('without_genres'),s.filters.withoutGenres);
  if(s.filters.withoutKeywords)assert.equal(u.searchParams.get('without_keywords'),s.filters.withoutKeywords);
  if(s.filters.releaseDateGte)assert.equal(u.searchParams.get(feed.type==='series'?'first_air_date.gte':'primary_release_date.gte'),s.filters.releaseDateGte);
 }
 assert.throws(()=>buildUrl({...f,source:{...f.source,filters:{madeUp:'x'}}},1,config),/unsupported/);
});
test('walking small pages preserves every position across provider boundaries without repeated provider calls',async()=>{
 let calls=0;const c=ready({fetcher:async url=>{calls++;const page=Number(new URL(url).searchParams.get('page'));return json({results:page<=3?items((page-1)*20+1):[],total_pages:3});}});
 const seen=[];let skip=0;
 for(let i=0;i<20;i++){const r=await c.catalog(f.type,f.id,'skip='+skip);if(!r.body.metas.length)break;seen.push(...r.body.metas.map(x=>x.id));skip+=r.body.metas.length;}
 assert.deepEqual(seen,Array.from({length:60},(_,i)=>'tmdb:'+(i+1)));assert.equal(calls,4);
 assert.ok(!('imdbRating' in (await c.catalog(f.type,f.id)).body.metas[0]));
});
test('concurrent offsets in the same provider page deduplicate and later requests hit cache',async()=>{
 let calls=0;const c=ready({fetcher:async()=>{calls++;await new Promise(r=>setTimeout(r,5));return json({results:items(),total_pages:2});}});
 const r=await Promise.all([0,8,16].map(skip=>c.catalog(f.type,f.id,'skip='+skip)));assert.equal(calls,1);assert.deepEqual(r.map(x=>x.body.metas.length),[8,8,4]);
 assert.equal((await c.catalog(f.type,f.id)).state,'hit');assert.equal(calls,1);
});
test('different genres and media types never reuse the same cached page',async()=>{
 let calls=0;const c=ready({fetcher:async()=>{calls++;return json({results:items()});}});
 for(const feed of config.feeds.slice(0,5))await c.catalog(feed.type,feed.id);
 assert.equal(calls,5);
});
test('initial burst is bounded to three concurrent upstream requests',async()=>{
 let active=0,peak=0;const c=ready({fetcher:async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,3));active--;return json({results:items()});}});
 await Promise.all(config.feeds.slice(0,100).map(feed=>c.catalog(feed.type,feed.id)));assert.equal(peak,3);assert.equal(c.active,0);assert.equal(c.queue.length,0);
});
test('stale usable data returns promptly while failed refresh retains it; expired data is not served',async()=>{
 let now=0,fail=false;const cache=new PageCache({clock:()=>now});const c=ready({cache,fetcher:async()=>{if(fail)throw Error('offline');return json({results:items()});}});
 await c.catalog(f.type,f.id);now=31*60*1000;fail=true;const r=await c.catalog(f.type,f.id);assert.equal(r.state,'stale');assert.equal(r.body.metas.length,8);
 await new Promise(r=>setImmediate(r));assert.equal(cache.entries.size,1);now=7*60*60*1000;await assert.rejects(c.catalog(f.type,f.id),e=>e.status===504);
});
test('provider failures and malformed responses never become empty successes',async()=>{
 let fail=true,calls=0;const c=ready({fetcher:async()=>{calls++;return fail?json({message:'failed'},500):json({results:items()});}});
 await assert.rejects(c.catalog(f.type,f.id),e=>e.status===502);assert.equal(c.cache.entries.size,0);fail=false;assert.equal((await c.catalog(f.type,f.id)).body.metas.length,8);assert.equal(calls,2);
 const bad=ready({fetcher:async()=>json({results:[{id:null}]})});await assert.rejects(bad.catalog(f.type,f.id),/Invalid provider/);assert.equal(bad.cache.entries.size,0);
});
test('timeouts abort a real abort-aware fetcher and release request capacity',async()=>{
 const c=ready({timeoutMs:5,fetcher:async(_u,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))});
 await assert.rejects(c.catalog(f.type,f.id),e=>e.status===504);assert.equal(c.active,0);
});
test('pagination and unknown source inputs fail before network access',async()=>{
 const c=ready({fetcher:async()=>{throw Error('should not fetch');}});
 for(const extra of ['skip=-1','skip=1.2','skip=10001','skip=0&skip=8','url=https://example.com'])await assert.rejects(c.catalog(f.type,f.id,extra),e=>e.status===400);
 await assert.rejects(c.catalog('series',f.id),e=>e.status===404);assert.deepEqual((await c.catalog(f.type,f.id,'skip=10000')).body.metas,[]);
});
test('bounded cache survives restart without persisting credentials or provider URL query secrets',async()=>{
 const parent=fileURLToPath(new URL('../private/',import.meta.url));await mkdir(parent,{recursive:true});const dir=await mkdtemp(join(parent,'cache-test-'));
 try{
  const cache=new PageCache({directory:dir,maxEntries:2});const c=ready({cache,fetcher:async()=>json({results:items()})});c.authKind='key';c.token='unit-test-key-never-persist';
  for(const feed of config.feeds.slice(0,3))await c.catalog(feed.type,feed.id);assert.equal(cache.entries.size,2);await cache.persist();assert.ok(!cache.persistenceError,cache.persistenceError);
  const raw=await readFile(join(dir,'catalog-pages.json'),'utf8');assert.ok(!raw.includes(c.token));assert.ok(!raw.includes('api_key'));assert.ok(!raw.includes('https://api'));
  const restored=new PageCache({directory:dir});await restored.restore();assert.equal(restored.entries.size,2);
 }finally{assert.ok(resolve(dir).startsWith(resolve(parent)+sep));await rm(dir,{recursive:true,force:true});}
});
test('missing credential is explicit and cannot silently serve approximate lists',async()=>{
 const c=new NetflixCatalog(config);await assert.rejects(c.catalog(f.type,f.id),e=>e.code==='setup_required');assert.equal(c.cache.entries.size,0);
});

test('server can boot offline using its previously validated credential and disk cache',async()=>{
 const parent=fileURLToPath(new URL('../private/',import.meta.url));await mkdir(parent,{recursive:true});const dir=await mkdtemp(join(parent,'offline-test-'));
 try{
  const cache=new PageCache({directory:dir});const c=ready({cache,fetcher:async()=>json({results:items()})});await c.catalog(f.type,f.id);await cache.persist();
  const secretFile=join(dir,'secret.json');await writeFile(secretFile,JSON.stringify({kind:'token',credential:'previously-validated-test-credential'}));
  let networkCalls=0;const app=await createServer({port:0,cacheDirectory:dir,secretFile,fetcher:async()=>{networkCalls++;throw Error('offline');}});
  try{assert.equal((await app.catalog.catalog(f.type,f.id)).state,'hit');assert.equal(networkCalls,0);assert.equal(app.catalog.stats().configured,true);}finally{await app.close();}
 }finally{assert.ok(resolve(dir).startsWith(resolve(parent)+sep));await rm(dir,{recursive:true,force:true});}
});

test('overload rejects both a full queue and an expired wait without leaking capacity',async()=>{
 const c=ready({maxConcurrent:1,maxQueue:1,timeoutMs:10});let finish;
 const active=c.limited(()=>new Promise(r=>finish=r));
 const waiting=assert.rejects(c.limited(async()=>{}),e=>e.code==='busy');
 await assert.rejects(c.limited(async()=>{}),e=>e.code==='busy');await waiting;
 assert.equal(c.queue.length,0);finish();await active;assert.equal(c.active,0);
});
test('HTTP routes enforce loopback host, setup origin/CSRF and expose no secret in health',async()=>{
 const app=await createServer({port:0,cacheDirectory:null,fetcher:async url=>json(new URL(url).pathname.endsWith('authentication')?{success:true}:{results:items()})});
 try{
  assert.equal((await fetch(app.url+'/manifest.json')).status,200);
  const hostStatus=await new Promise((resolve,reject)=>{const r=http.get(app.url+'/health.json',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});r.on('error',reject);});assert.equal(hostStatus,403);
  assert.equal((await fetch(app.url+'/setup',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/x-www-form-urlencoded'},body:'credential=bad'})).status,403);
  const body=new URLSearchParams({csrf:app.csrf,kind:'key',credential:'unit-test-private-key'});
  const saved=await fetch(app.url+'/setup',{method:'POST',headers:{Origin:app.url,'Content-Type':'application/x-www-form-urlencoded'},body});assert.equal(saved.status,200);
  const health=await(await fetch(app.url+'/health.json')).text();assert.ok(!health.includes('unit-test-private-key'));assert.equal(JSON.parse(health).configured,true);
  assert.equal((await fetch(app.url+`/catalog/${f.type}/${f.id}.json`)).status,200);
 }finally{await app.close();}
});

