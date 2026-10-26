// The source map contains public catalog filters only. No account or playback keys.
const CONFIG = __HUB_CONFIG__;
const ID = 'community.nuvio.servicehub';
const VERSION = '0.1.0';
const PAGE_SIZE = 20;
const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Expose-Headers':'X-Catalog-Cache, X-Catalog-Stale, Retry-After'};
class HubError extends Error { constructor(status, code, message) { super(message); this.status=status; this.code=code; } }
const json = (body,status=200,headers={}) => new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff',...headers}});
const cleanImage = value => { try { const u=new URL(value); return u.protocol==='https:' ? u.href : undefined; } catch { return undefined; } };
function optionsFor(service,type) {
  const labels=Object.keys(service.groups[type]);
  return labels.includes('Popular') ? ['Popular',...labels.filter(x=>x!=='Popular')] : labels;
}
export function makeManifest(serviceId) {
  const selected=serviceId ? CONFIG.services.filter(s=>s.id===serviceId) : CONFIG.services;
  if (!selected.length) throw new HubError(404,'unknown_service','Unknown service');
  const catalogs=[];
  for(const s of selected) for(const type of ['movie','series']) {
    if(s.charts[type]) catalogs.push({id:`${s.id}.top10`,type,name:`${s.name} Top 10 — US`,pageSize:10,showInHome:false,extra:[{name:'genre',isRequired:!serviceId,options:['US Top 10']},{name:'skip',isRequired:false}]});
    const options=optionsFor(s,type);
    if(options.length) catalogs.push({id:`${s.id}.browse`,type,name:`${s.name} ${type==='movie'?'Movies':'Series'}`,pageSize:PAGE_SIZE,showInHome:false,extra:[{name:'genre',isRequired:!serviceId,options,optionsLimit:1},{name:'skip',isRequired:false}]});
  }
  return {id:serviceId?`${ID}.${serviceId}`:ID,version:VERSION,name:serviceId?`${selected[0].name} Service Hub`:'Service Hub — US',description:'Service-specific catalogs with bounded requests and cached pages. Catalogs only; keep your existing metadata and Real-Debrid addons.',resources:['catalog'],types:['movie','series'],catalogs,behaviorHints:{configurable:false}};
}
export function parseExtras(path='') {
  if(path.length>2048) throw new HubError(400,'bad_extra','Filter is too long');
  const p=new URLSearchParams(path),seen=new Set();
  for(const [k] of p) {if(!['genre','skip'].includes(k)||seen.has(k)) throw new HubError(400,'bad_extra','Unsupported or duplicate filter');seen.add(k);}
  const raw=p.get('skip')||'0';
  if(!/^\d+$/.test(raw)||Number(raw)>10000) throw new HubError(400,'bad_skip','Skip must be between 0 and 10000');
  return {genre:p.get('genre'),skip:Number(raw)};
}
export function buildTmdbUrl(source,type,skip,now=Date.now()) {
  const media=type==='series'?'tv':'movie',f=source.filters||{};
  const kind=source.tmdbSourceType;
  if(!['DISCOVER','LIST'].includes(kind)) throw new HubError(422,'unsupported_source','This source needs a client/provider adapter');
  const u=new URL(kind==='LIST'?`https://api.themoviedb.org/3/list/${source.tmdbId}`:`https://api.themoviedb.org/3/discover/${media}`);
  u.searchParams.set('language',CONFIG.language);u.searchParams.set('page',String(Math.floor(skip/PAGE_SIZE)+1));
  if(kind==='LIST') return u;
  u.searchParams.set('include_adult','false');
  const sort=source.sortBy||'popularity.desc';
  u.searchParams.set('sort_by',media==='tv'?sort.replace('primary_release_date','first_air_date'):sort);
  const map={withGenres:'with_genres',withoutGenres:'without_genres',withCompanies:'with_companies',withoutCompanies:'without_companies',withNetworks:'with_networks',withKeywords:'with_keywords',withoutKeywords:'without_keywords',withOriginalLanguage:'with_original_language',withOriginCountry:'with_origin_country',withWatchProviders:'with_watch_providers',withoutWatchProviders:'without_watch_providers',voteCountGte:'vote_count.gte',voteAverageGte:'vote_average.gte',voteAverageLte:'vote_average.lte',year:media==='tv'?'first_air_date_year':'primary_release_year',releaseDateGte:media==='tv'?'first_air_date.gte':'primary_release_date.gte',releaseDateLte:media==='tv'?'first_air_date.lte':'primary_release_date.lte'};
  for(const [k,v] of Object.entries(f)) if(v!==null&&v!==undefined&&map[k])u.searchParams.set(map[k],String(v));
  if(f.withWatchProviders||f.withoutWatchProviders){u.searchParams.set('watch_region',CONFIG.region);u.searchParams.set('with_watch_monetization_types','flatrate|free|ads|rent|buy');}
  return u;
}
function tmdbMeta(item,type) {
  if(!item||!Number.isInteger(Number(item.id))||Number(item.id)<=0) return null;
  const name=item.title||item.name;if(typeof name!=='string'||!name.trim())return null;
  const date=item.release_date||item.first_air_date||'';
  // A TMDB vote average is not an IMDb rating. Metadata remains with existing addons.
  return {id:`tmdb:${item.id}`,type,name:name.trim(),poster:item.poster_path?`https://image.tmdb.org/t/p/w342${item.poster_path}`:undefined,posterShape:'poster',background:item.backdrop_path?`https://image.tmdb.org/t/p/w1280${item.backdrop_path}`:undefined,description:typeof item.overview==='string'?item.overview:undefined,releaseInfo:date.slice(0,4),released:/^\d{4}-\d{2}-\d{2}$/.test(date)?`${date}T00:00:00.000Z`:undefined};
}
function normalizeMetas(items,type) {
  if(!Array.isArray(items))throw new HubError(502,'bad_upstream','Catalog returned invalid data');
  const seen=new Set(),out=[];
  for(const m of items){if(!m||typeof m.id!=='string'||!m.id||typeof m.name!=='string'||!m.name)continue;const key=`${type}:${m.id}`;if(seen.has(key))continue;seen.add(key);const value={...m,type};if(value.poster)value.poster=cleanImage(value.poster);if(value.background)value.background=cleanImage(value.background);out.push(value);}
  return out;
}
export function createHub({fetcher=globalThis.fetch,clock=Date.now,maxConcurrent=3,maxQueue=24,maxEntries=128,maxCacheBytes=12*1024*1024,timeoutMs=8000}={}) {
  const cache=new Map(),flights=new Map(),queue=[];let active=0,bytes=0;
  function remember(key,value,ttl){const size=JSON.stringify(value).length*2;if(size>2*1024*1024)return;const old=cache.get(key);if(old)bytes-=old.size;cache.delete(key);cache.set(key,{value,at:clock(),ttl,size});bytes+=size;while(cache.size>maxEntries||bytes>maxCacheBytes){const k=cache.keys().next().value;bytes-=cache.get(k).size;cache.delete(k);}}
  async function limited(fn) {
    if(active>=maxConcurrent){if(queue.length>=maxQueue)throw new HubError(503,'busy','Catalog is busy; retry shortly');await new Promise(resolve=>queue.push(resolve));}
    else active++;
    try{return await fn();}finally{const next=queue.shift();if(next)next();else active--;}
  }
  async function upstream(url,headers={}) {
    return limited(async()=>{const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),timeoutMs);
      try{const r=await fetcher(url,{headers:{Accept:'application/json',...headers},signal:ac.signal,redirect:'error'});if(!r.ok)throw new HubError(502,'upstream_unavailable','Catalog provider is temporarily unavailable');const limit=2*1024*1024;if(Number(r.headers.get('Content-Length'))>limit){ac.abort();throw new HubError(502,'large_upstream','Catalog response exceeded its limit');}const reader=r.body?.getReader(),decoder=new TextDecoder();let text='',count=0;if(reader){while(true){const part=await reader.read();if(part.done)break;count+=part.value.byteLength;if(count>limit){ac.abort();await reader.cancel();throw new HubError(502,'large_upstream','Catalog response exceeded its limit');}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}try{return JSON.parse(text);}catch{throw new HubError(502,'bad_upstream','Catalog provider returned invalid JSON');}}
      catch(e){if(e instanceof HubError)throw e;throw new HubError(504,'upstream_timeout','Catalog provider did not respond in time');}finally{clearTimeout(timer);}
    });
  }
  function keyHeader(env){const v=env.TMDB_READ_ACCESS_TOKEN||env.TMDB_API_KEY;if(!v)return null;return {Authorization:`Bearer ${v}`};}
  async function load(service,type,kind,filter,env){
    if(kind==='top10') {
      if(!service.charts[type])throw new HubError(404,'no_chart','No supported US chart for this service');
      if(filter.genre&&filter.genre!=='US Top 10')throw new HubError(400,'bad_genre','Unknown chart filter');
      if(filter.skip)return {metas:[]};
      const data=await upstream(`${CONFIG.topxBase}/catalog/${type}/${encodeURIComponent(service.charts[type])}.json`);
      return {metas:normalizeMetas(data.metas,type).slice(0,10)};
    }
    const categories=service.groups[type],label=filter.genre||optionsFor(service,type)[0],source=categories[label];
    if(!source)throw new HubError(400,'bad_genre','Unknown service category');
    if(source.provider==='trakt'){
      if(!env.TRAKT_CLIENT_ID)throw new HubError(503,'configuration_required','This category requires a server-side Trakt client ID; your existing catalog is unchanged');
      const page=Math.floor(filter.skip/PAGE_SIZE)+1;
      const data=await upstream(`https://api.trakt.tv/lists/${source.traktListId}/items/${type==='series'?'shows':'movies'}?page=${page}&limit=${PAGE_SIZE}&extended=full`,{'trakt-api-version':'2','trakt-api-key':env.TRAKT_CLIENT_ID});
      if(!Array.isArray(data))throw new HubError(502,'bad_upstream','Invalid Trakt catalog');
      return {metas:normalizeMetas(data.map(x=>{const v=x.movie||x.show||{};return {id:v.ids?.imdb||(v.ids?.tmdb?`tmdb:${v.ids.tmdb}`:''),type,name:v.title,releaseInfo:v.year?String(v.year):'',description:v.overview};}),type).slice(filter.skip%PAGE_SIZE)};
    }
    const auth=keyHeader(env);
    if(auth){
      const u=buildTmdbUrl(source,type,filter.skip,clock());
      const headers=env.TMDB_READ_ACCESS_TOKEN?auth:{};
      if(!env.TMDB_READ_ACCESS_TOKEN)u.searchParams.set('api_key',env.TMDB_API_KEY);
      const data=await upstream(u.href,headers);const items=data.results||data.items;
      if(!Array.isArray(items))throw new HubError(502,'bad_upstream','Catalog provider returned no result array');
      const metas=normalizeMetas(items.filter(v=>!v.media_type||v.media_type===(type==='series'?'tv':'movie')).map(v=>tmdbMeta(v,type)).filter(Boolean),type);
      return {metas:source.tmdbSourceType==='LIST'?metas.slice(filter.skip,filter.skip+PAGE_SIZE):metas.slice(filter.skip%PAGE_SIZE,PAGE_SIZE)};
    }
    // A documented public provider supports only these three services and real genres.
    const publicId=CONFIG.publicServices[service.id];
    const available=type==='movie'?['Action','Adventure','Animation','Comedy','Crime','Documentary','Drama','Family','Fantasy','History','Horror','Music','Mystery','Romance','Science Fiction','Thriller','War','Western']:['Action & Adventure','Animation','Comedy','Crime','Documentary','Drama','Family','Kids','Mystery','News','Reality','Sci-Fi & Fantasy','Soap','Talk','War & Politics','Western'];
    if(env.ALLOW_PUBLIC_PREVIEW!=='true'||!publicId||!['Popular',...available].includes(label)||source.tmdbSourceType!=='DISCOVER')throw new HubError(503,'configuration_required','A server-side TMDB credential is needed for the original service/category filters; no generic catalog is substituted');
    const extras=new URLSearchParams();if(label!=='Popular')extras.set('genre',label);if(filter.skip)extras.set('skip',String(filter.skip));
    const tail=extras.size?`/${extras}`:'';
    const data=await upstream(`${CONFIG.publicCatalogBase}/catalog/${type}/${publicId}-${type==='series'?'series':'movies'}${tail}.json`);
    return {metas:normalizeMetas(data.metas,type).slice(0,PAGE_SIZE)};
  }
  async function catalog(service,type,kind,filter,env,ctx) {
    const canonicalGenre=kind==='top10'?(filter.genre||'US Top 10'):filter.genre||optionsFor(service,type)[0]||'';
    const key=JSON.stringify([service.id,type,kind,canonicalGenre,filter.skip,Boolean(env.TMDB_API_KEY||env.TMDB_READ_ACCESS_TOKEN),Boolean(env.TRAKT_CLIENT_ID),env.ALLOW_PUBLIC_PREVIEW==='true']);
    const ttl=kind==='top10'?300000:1800000;const old=cache.get(key);
    const refresh=()=>{if(flights.has(key))return flights.get(key);const p=load(service,type,kind,filter,env).then(value=>{remember(key,value,value.metas.length?ttl:60000);return value;}).finally(()=>flights.delete(key));flights.set(key,p);return p;};
    if(old&&clock()-old.at<old.ttl){cache.delete(key);cache.set(key,old);return {value:old.value,state:'hit',stale:false};}
    if(old&&clock()-old.at<21600000){const task=refresh().catch(()=>{});if(ctx?.waitUntil)ctx.waitUntil(task);return {value:old.value,state:'stale',stale:true};}
    return {value:await refresh(),state:'miss',stale:false};
  }
  async function handle(request,env={},ctx={}) {
    try{
      const u=new URL(request.url);if(u.search)throw new HubError(400,'bad_query','Use protocol path filters');
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
      if(!['GET','HEAD'].includes(request.method))return json({error:'method_not_allowed'},405,{Allow:'GET, HEAD, OPTIONS'});
      const head=request.method==='HEAD';let response;
      if(u.pathname==='/'||u.pathname==='/configure')response=new Response(PAGE,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src https:; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'",'X-Content-Type-Options':'nosniff'}});
      else if(u.pathname==='/health.json')response=json({ok:true,version:VERSION,region:CONFIG.region,services:CONFIG.services.length,tmdbConfigured:Boolean(env.TMDB_READ_ACCESS_TOKEN||env.TMDB_API_KEY),traktConfigured:Boolean(env.TRAKT_CLIENT_ID),fullCategoryCoverageConfigured:Boolean((env.TMDB_READ_ACCESS_TOKEN||env.TMDB_API_KEY)&&env.TRAKT_CLIENT_ID),publicPreviewEnabled:env.ALLOW_PUBLIC_PREVIEW==='true',nativeIntegrationVerified:false,catalogOnly:true},200,{'Cache-Control':'no-store'});
      else if(u.pathname==='/manifest.json')response=json(makeManifest(),200,{'Cache-Control':'public, max-age=300'});
      else if(/^\/service\/[a-z0-9-]+\/manifest\.json$/.test(u.pathname))response=json(makeManifest(u.pathname.split('/')[2]),200,{'Cache-Control':'public, max-age=300'});
      else {
        const m=u.pathname.match(/^\/catalog\/(movie|series)\/([a-z0-9-]+)\.(browse|top10)(?:\/([^/]*))?\.json$/);
        if(!m)throw new HubError(404,'not_found','Unknown catalog route');
        const service=CONFIG.services.find(s=>s.id===m[2]);if(!service)throw new HubError(404,'unknown_service','Unknown service');
        const filter=parseExtras(m[4]||'');const result=await catalog(service,m[1],m[3],filter,env,ctx);
        response=json(result.value,200,{'Cache-Control':result.stale?'no-cache':'public, max-age=60','X-Catalog-Cache':result.state,'X-Catalog-Stale':String(result.stale)});
      }
      return head?new Response(null,{status:response.status,headers:response.headers}):response;
    }catch(e){const known=e instanceof HubError;return json({error:known?e.code:'internal_error',message:known?e.message:'Catalog could not be loaded'},known?e.status:500,{'Cache-Control':'no-store',...(e.status===503?{'Retry-After':'3'}:{})});}
  }
  return {fetch:handle,stats:()=>({entries:cache.size,bytes,active,queued:queue.length,inflight:flights.size})};
}
const PAGE = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Service Hub · Nuvio</title><style>html{color-scheme:dark;font:16px system-ui;background:#090d12;color:#edf3f8}body{margin:0}main{max-width:1080px;margin:64px auto;padding:24px}small{color:#66d8ac;letter-spacing:.14em}h1{font-size:clamp(36px,6vw,66px);margin:18px 0}p{color:#aebbc9;line-height:1.6;max-width:760px}nav,section{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}select,button,a.button{background:#18232e;color:#fff;border:1px solid #3b4b5b;border-radius:9px;padding:12px;font:inherit}button{cursor:pointer}button:focus-visible,select:focus-visible{outline:3px solid #66d8ac}article{width:150px}article img{width:150px;height:225px;object-fit:cover;border-radius:9px;background:#18232e}article.landscape{width:240px}article.landscape img{width:240px;height:135px}article p{font-size:14px}code{overflow-wrap:anywhere;color:#66d8ac}#status{min-height:28px;color:#e2ba75}.notice{padding:20px;border-left:3px solid #66d8ac;background:#111a23}footer{margin-top:40px;color:#8fa1b3}</style><main><small>CATALOG ONLY · US REGION</small><h1>One service.<br>Less waiting.</h1><p>A separate compatibility preview for a lightweight Nuvio catalog addon. Existing playback, Real-Debrid, posters and collections are unchanged.</p><p class="notice">Test stage. Charts and a limited public catalog adapter work without credentials. Complete category coverage requires a server-side TMDB credential; some curated lists also require a Trakt client ID. Native in-folder filter support must be verified before replacing your working setup. A private preview URL cannot be installed in Nuvio; public endpoint access must be enabled separately.</p><nav aria-label="Catalog filters"><select id="service" aria-label="Streaming service"></select><select id="type" aria-label="Media type"><option value="movie">Movies</option><option value="series">Series</option></select><select id="category" aria-label="Category"></select><button id="load">Show titles</button><button id="next">Next page</button></nav><p id="status" role="status"></p><section id="items" aria-label="Catalog titles"></section><p>Selected-service test manifest: <code id="manifest"></code></p><button id="copy">Copy manifest URL</button><footer>Metadata only. No stream resource, playback keys, account sign-in or viewing history. This preview is not a replacement Nuvio client.</footer></main><script>
const $=s=>document.querySelector(s);let manifest,skip=0,controller,categoryVersion=0;const services=__SERVICE_NAMES__;
for(const s of services){const o=document.createElement('option');o.value=s.id;o.textContent=s.name;$('#service').append(o)}
function resetResults(){if(controller)controller.abort();controller=null;skip=0;$('#items').replaceChildren();$('#next').disabled=true;$('#status').textContent='Choose Show titles to load this category.'} async function categories(){const version=++categoryVersion;resetResults();$('#load').disabled=true;const service=$('#service').value;let type=$('#type').value;const r=await fetch('/service/'+service+'/manifest.json');const nextManifest=await r.json();if(version!==categoryVersion)return;manifest=nextManifest;if(!manifest.catalogs.some(c=>c.type===type)&&manifest.catalogs.length){type=manifest.catalogs[0].type;$('#type').value=type}$('#category').replaceChildren();for(const c of manifest.catalogs.filter(c=>c.type===type)){if(c.id.endsWith('.top10')){const o=document.createElement('option');o.value=JSON.stringify([c.id,'US Top 10']);o.textContent='Top 10';$('#category').append(o)}else for(const name of c.extra.find(x=>x.name==='genre').options){const o=document.createElement('option');o.value=JSON.stringify([c.id,name]);o.textContent=name;$('#category').append(o)}}$('#load').disabled=!$('#category').options.length;$('#manifest').textContent=location.origin+'/service/'+service+'/manifest.json';$('#status').textContent='Choose a category to test. Nothing is installed automatically.'}
async function load(append=false){if(!append)skip=0;if(controller)controller.abort();controller=new AbortController();const current=controller;$('#status').textContent='Loading selected category…';try{const [id,genre]=JSON.parse($('#category').value),extra=new URLSearchParams({genre,skip:String(skip)});const r=await fetch('/catalog/'+$('#type').value+'/'+id+'/'+extra+'.json',{signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(data.message||'Catalog unavailable');if(current!==controller)return;if(!append)$('#items').replaceChildren();for(const m of data.metas){const a=document.createElement('article');if(m.posterShape==='landscape')a.className='landscape';const im=document.createElement('img');if(m.poster)im.src=m.poster;im.alt=m.name;im.loading='lazy';const p=document.createElement('p');p.textContent=m.name+(m.releaseInfo?' · '+m.releaseInfo:'');a.append(im,p);$('#items').append(a)}$('#status').textContent=data.metas.length+' titles · cache '+r.headers.get('X-Catalog-Cache')+(r.headers.get('X-Catalog-Stale')==='true'?' · last usable cached result':'');$('#next').disabled=data.metas.length<20;skip+=20;}catch(e){if(e.name!=='AbortError'&&current===controller)$('#status').textContent=e.message}}
$('#service').onchange=categories;$('#type').onchange=categories;$('#category').onchange=resetResults;$('#load').onclick=()=>load();$('#next').onclick=()=>load(true);$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#manifest').textContent);$('#status').textContent='Manifest copied. Keep existing addons installed during testing.'}catch{$('#status').textContent='Copy the manifest URL shown below the catalog.'}};categories();
</script></html>`;
const hub=createHub();export default {fetch:(request,env,ctx)=>hub.fetch(request,env,ctx)};
