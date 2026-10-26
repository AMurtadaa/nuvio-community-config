import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHub,makeManifest,parseExtras,buildTmdbUrl} from '../worker/index.js';
const config=JSON.parse(await readFile(new URL('../worker/config.json',import.meta.url),'utf8'));
const request=(p,method='GET')=>new Request('https://hub.test'+p,{method});
const route=(id='netflix',type='movie',kind='browse',extra='genre=Popular')=>`/catalog/${type}/${id}.${kind}/${extra}.json`;
const body=r=>r.json();
const apiEnv={TMDB_API_KEY:'unit-test-key'};
const tmdbItem=(id=1)=>({id,title:`Movie ${id}`,name:`Series ${id}`,poster_path:'/poster.jpg',backdrop_path:'/backdrop.jpg',vote_average:9.1,release_date:'2025-01-01'});
const result=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
test('manifest is catalog-only, 22 services, unique identities, no autoplay Home flood',()=>{
 const m=makeManifest();assert.deepEqual(m.resources,['catalog']);assert.equal(config.services.length,22);
 assert.equal(new Set(m.catalogs.map(c=>c.type+':'+c.id)).size,m.catalogs.length);
 assert.ok(m.catalogs.every(c=>c.extra.find(e=>e.name==='genre').isRequired));
 assert.ok(!JSON.stringify(m).includes('api_key'));assert.ok(!('stream' in m));
});
test('service manifests expose only their own two browse and supported chart catalogs',()=>{
 const m=makeManifest('netflix');assert.equal(m.catalogs.length,4);assert.ok(m.catalogs.every(c=>c.id.startsWith('netflix.')));
 const n=makeManifest('crave');assert.ok(n.catalogs.every(c=>c.id.endsWith('.browse')));
 assert.throws(()=>makeManifest('missing'));
});
test('all 723 original service category sources are represented without credentials',()=>{
 assert.equal(config.services.reduce((n,s)=>n+Object.values(s.groups).reduce((a,v)=>a+Object.keys(v).length,0),0),723);
 assert.ok(!JSON.stringify(config).includes('REDACTED'));assert.ok(config.services.every(s=>s.groups.movie&&s.groups.series));
});
test('extra parser accepts encoded ampersands but rejects invalid, duplicate and arbitrary URL parameters',()=>{
 assert.equal(parseExtras('genre=Sci-Fi+%26+Fantasy&skip=20').genre,'Sci-Fi & Fantasy');
 for(const value of ['skip=-1','skip=3.4','skip=10001','skip=0&skip=20','url=https://localhost','genre=a&genre=b'])assert.throws(()=>parseExtras(value));
});
test('TMDB queries preserve provider/genre/exclusion filters and explicit US scope',()=>{
 const s=config.services.find(s=>s.id==='netflix').groups.movie.Popular,u=buildTmdbUrl(s,'movie',20);
 assert.equal(u.searchParams.get('page'),'2');assert.equal(u.searchParams.get('watch_region'),'US');assert.equal(u.searchParams.get('with_watch_providers'),s.filters.withWatchProviders);assert.equal(u.searchParams.get('without_genres'),s.filters.withoutGenres);
});
test('TV dates and sorting use TV-specific field names',()=>{
 const u=buildTmdbUrl({tmdbSourceType:'DISCOVER',sortBy:'primary_release_date.desc',filters:{releaseDateGte:'2025-01-01'}},'series',0);
 assert.equal(u.searchParams.get('sort_by'),'first_air_date.desc');assert.equal(u.searchParams.get('first_air_date.gte'),'2025-01-01');
});
test('successful TMDB responses have standard typed IDs and do not label TMDB scores as IMDb',async()=>{
 const hub=createHub({fetcher:async()=>result({results:[tmdbItem(1),tmdbItem(1),{bad:true}]})});
 const r=await hub.fetch(request(route()),apiEnv);assert.equal(r.status,200);const d=await body(r);assert.equal(d.metas.length,1);assert.equal(d.metas[0].id,'tmdb:1');assert.equal(d.metas[0].type,'movie');assert.ok(!('imdbRating' in d.metas[0]));
});
test('parallel identical requests share one upstream operation; later requests hit cache',async()=>{
 let calls=0;const hub=createHub({fetcher:async()=>{calls++;await new Promise(r=>setTimeout(r,10));return result({results:[tmdbItem()]});}});
 const rs=await Promise.all(Array.from({length:8},()=>hub.fetch(request(route()),apiEnv)));assert.ok(rs.every(r=>r.status===200));assert.equal(calls,1);
 const r=await hub.fetch(request(route()),apiEnv);assert.equal(r.headers.get('X-Catalog-Cache'),'hit');assert.equal(calls,1);
});
test('provider concurrency is bounded across distinct filters',async()=>{
 let active=0,peak=0;const hub=createHub({maxConcurrent:2,fetcher:async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return result({results:[tmdbItem()]});}});
 await Promise.all(['Popular','New','Top Rated','Action','Comedy','Drama'].map(g=>hub.fetch(request(route('netflix','movie','browse',new URLSearchParams({genre:g}).toString())),apiEnv)));
 assert.equal(peak,2);assert.equal(hub.stats().active,0);assert.equal(hub.stats().queued,0);
});
test('queue overflow fails safely and releases existing slots',async()=>{
 let release;const gate=new Promise(r=>release=r);const hub=createHub({maxConcurrent:1,maxQueue:1,fetcher:async()=>{await gate;return result({results:[tmdbItem()]});}});
 const a=hub.fetch(request(route()),apiEnv),b=hub.fetch(request(route('netflix','series')),apiEnv);
 const r=await hub.fetch(request(route('hulu')),apiEnv);assert.equal(r.status,503);assert.equal((await body(r)).error,'busy');release();await Promise.all([a,b]);assert.equal(hub.stats().active,0);
});
test('failed requests are not cached; retry can recover',async()=>{
 let fail=true;const hub=createHub({fetcher:async()=>fail?new Response('bad',{status:500}):result({results:[tmdbItem()]})});
 assert.equal((await hub.fetch(request(route()),apiEnv)).status,502);fail=false;assert.equal((await hub.fetch(request(route()),apiEnv)).status,200);
});
test('timeouts abort underlying fetch and release the semaphore',async()=>{
 const hub=createHub({timeoutMs:5,fetcher:(_,o)=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(Error('aborted'))))});
 const r=await hub.fetch(request(route()),apiEnv);assert.equal(r.status,504);assert.equal(hub.stats().active,0);assert.equal(hub.stats().inflight,0);
});
test('stale response is returned immediately and preserved when background refresh fails',async()=>{
 let now=0,fail=false;const tasks=[];const hub=createHub({clock:()=>now,fetcher:async()=>fail?new Response('',{status:500}):result({results:[tmdbItem()]})});
 await hub.fetch(request(route()),apiEnv);now=1900000;fail=true;
 const r=await hub.fetch(request(route()),apiEnv,{waitUntil:p=>tasks.push(p)});assert.equal(r.status,200);assert.equal(r.headers.get('X-Catalog-Stale'),'true');await Promise.all(tasks);assert.equal(hub.stats().entries,1);
});
test('memory cache evicts old pages within configured bounds',async()=>{
 const hub=createHub({maxEntries:2,fetcher:async()=>result({results:[tmdbItem()]})});
 for(const genre of ['Popular','Action','Comedy'])await hub.fetch(request(route('netflix','movie','browse','genre='+genre)),apiEnv);
 assert.equal(hub.stats().entries,2);
});
test('charts preserve IDs, image shape and ranking order; pagination terminates',async()=>{
 let calls=0;const hub=createHub({fetcher:async()=>{calls++;return result({metas:[{id:'tt2',name:'Rank 1',posterShape:'landscape',poster:'https://topx.stremio-italia.eu/a.jpg'},{id:'tt1',name:'Rank 2',posterShape:'landscape'}]});}});
 const r=await hub.fetch(request(route('netflix','movie','top10','genre=US+Top+10')));const d=await body(r);assert.deepEqual(d.metas.map(x=>x.id),['tt2','tt1']);assert.ok(d.metas.every(x=>x.posterShape==='landscape'));
 assert.deepEqual((await body(await hub.fetch(request(route('netflix','movie','top10','skip=20'))))).metas,[]);assert.equal(calls,1);
});
test('missing credentials cannot silently substitute generic titles or wrong service',async()=>{
 let calls=0;const hub=createHub({fetcher:async()=>{calls++;return result({metas:[]});}});
 for(const id of ['netflix','hulu','crave']){const r=await hub.fetch(request(route(id)));assert.equal(r.status,503);assert.equal((await body(r)).error,'configuration_required');}assert.equal(calls,0);
});
test('public fallback is explicitly opted in and limited to supported real service categories',async()=>{
 let seen;const hub=createHub({fetcher:async url=>{seen=url;return result({metas:[{id:'tt1',name:'Movie'}]});}});
 const r=await hub.fetch(request(route()),{ALLOW_PUBLIC_PREVIEW:'true'});assert.equal(r.status,200);assert.match(seen,/netflix-movies/);
 assert.equal((await hub.fetch(request(route('hulu')),{ALLOW_PUBLIC_PREVIEW:'true'})).status,503);
 assert.equal((await hub.fetch(request(route('netflix','movie','browse','genre=New')),{ALLOW_PUBLIC_PREVIEW:'true'})).status,503);
});
test('TMDB list pagination slices the list rather than repeating the first page',async()=>{
 const service=config.services.find(s=>Object.values(s.groups.movie).some(v=>v.tmdbSourceType==='LIST'));assert.ok(service);
 const [label]=Object.entries(service.groups.movie).find(([,v])=>v.tmdbSourceType==='LIST');
 const hub=createHub({fetcher:async()=>result({items:Array.from({length:45},(_,i)=>tmdbItem(i+1))})});
 const a=await body(await hub.fetch(request(route(service.id,'movie','browse',new URLSearchParams({genre:label,skip:'20'}).toString())),apiEnv));assert.equal(a.metas[0].id,'tmdb:21');assert.equal(a.metas.length,20);
});
test('health, CORS, HEAD and route rejection do not trigger upstream work',async()=>{
 const hub=createHub({fetcher:async()=>{throw Error('Unexpected upstream')}});
 const health=await hub.fetch(request('/health.json'));assert.equal(health.status,200);assert.equal((await body(health)).catalogOnly,true);
 assert.equal((await hub.fetch(request('/manifest.json','HEAD'))).body,null);
 const opt=await hub.fetch(request('/manifest.json','OPTIONS'));assert.equal(opt.status,204);assert.equal(opt.headers.get('Access-Control-Allow-Origin'),'*');
 assert.equal((await hub.fetch(request('/stream/movie/tt1.json'))).status,404);
 assert.equal((await hub.fetch(request('/manifest.json','POST'))).status,405);
 assert.equal((await hub.fetch(request(route('missing')))).status,404);
});
test('malformed or oversized provider responses fail without leaking request URLs or secrets',async()=>{
 for(const data of ['<html>error</html>',JSON.stringify({error:'bad'}),'x'.repeat(2100000)]){
  const hub=createHub({fetcher:async()=>new Response(data)});const r=await hub.fetch(request(route()),apiEnv);assert.equal(r.status,502);assert.ok(!(await r.text()).includes('unit-test-key'));
 }
});
test('cached chart cannot bypass filter validation',async()=>{
 const hub=createHub({fetcher:async()=>result({metas:[{id:'tt1',name:'Chart'}]})});
 await hub.fetch(request(route('netflix','movie','top10','genre=US+Top+10')));
 assert.equal((await hub.fetch(request(route('netflix','movie','top10','genre=Wrong')))).status,400);
});
test('bare and explicitly selected default categories share their cache entry',async()=>{
 let calls=0;const hub=createHub({fetcher:async()=>{calls++;return result({results:[tmdbItem()]});}});
 await hub.fetch(request('/catalog/movie/netflix.browse.json'),apiEnv);
 const r=await hub.fetch(request(route()),apiEnv);assert.equal(calls,1);assert.equal(r.headers.get('X-Catalog-Cache'),'hit');
});
