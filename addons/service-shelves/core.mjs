import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';

export class CatalogError extends Error {
  constructor(status,code,message){super(message);this.status=status;this.code=code;}
}
const hash=s=>createHash('sha256').update(s).digest('hex');
export const TTL=30*60*1000, STALE=6*60*60*1000;
export function buildUrl(feed,page,config){
  const s=feed.source,f=s.filters||{},tv=feed.type==='series';
  if(s.tmdbSourceType!=='DISCOVER')throw new CatalogError(422,'unsupported_source','Unsupported source definition');
  const u=new URL(`https://api.themoviedb.org/3/discover/${tv?'tv':'movie'}`);
  u.searchParams.set('language',config.language);u.searchParams.set('page',String(page));u.searchParams.set('include_adult','false');
  u.searchParams.set('sort_by',(s.sortBy||'popularity.desc').replace(tv?'primary_release_date':'first_air_date',tv?'first_air_date':'primary_release_date'));
  const map={withGenres:'with_genres',withoutGenres:'without_genres',releaseDateGte:tv?'first_air_date.gte':'primary_release_date.gte',releaseDateLte:tv?'first_air_date.lte':'primary_release_date.lte',voteCountGte:'vote_count.gte',voteAverageGte:'vote_average.gte',voteAverageLte:'vote_average.lte',withOriginalLanguage:'with_original_language',withOriginCountry:'with_origin_country',withKeywords:'with_keywords',withoutKeywords:'without_keywords',withWatchProviders:'with_watch_providers',withoutWatchProviders:'without_watch_providers',withCompanies:'with_companies',withoutCompanies:'without_companies',withNetworks:'with_networks',year:tv?'first_air_date_year':'primary_release_year'};
  for(const [k,v] of Object.entries(f)){
    if(v===null||v===undefined||v==='')continue;
    if(k==='watchRegion')continue;
    if(!map[k])throw new CatalogError(422,'unsupported_filter','A saved source filter is unsupported');
    u.searchParams.set(map[k],String(v));
  }
  if(f.withWatchProviders||f.withoutWatchProviders)u.searchParams.set('watch_region',f.watchRegion||config.region);
  if(f.withWatchProviders)u.searchParams.set('with_watch_monetization_types','flatrate|free|ads|rent|buy');
  u.searchParams.sort();return u;
}

export class PageCache {
  constructor({clock=Date.now,directory,maxEntries=128,maxBytes=12*1024*1024}={}){
    Object.assign(this,{clock,directory,maxEntries,maxBytes});this.entries=new Map();this.bytes=0;this.pending=Promise.resolve();
  }
  async restore(){
    if(!this.directory)return;
    try{
      const {stat}=await import('node:fs/promises'),p=resolve(this.directory,'catalog-pages.json');
      if((await stat(p)).size>this.maxBytes*2)return;
      const x=JSON.parse(await readFile(p,'utf8'));
      for(const [key,e] of x)if(/^[a-f0-9]{64}$/.test(key)&&Number.isFinite(e.at)&&this.clock()-e.at>=0&&this.clock()-e.at<STALE&&e.value&&Array.isArray(e.value.results))this.put(key,e.value,e.at,false);
    }catch{/* An absent/corrupt cache never prevents startup. */}
  }
  get(key){const e=this.entries.get(key);if(!e)return null;const age=this.clock()-e.at;
    if(age<0||age>=STALE){this.bytes-=e.size;this.entries.delete(key);return null;}
    this.entries.delete(key);this.entries.set(key,e);return {...e,age,stale:age>=TTL};
  }
  put(key,value,at=this.clock(),persist=true){
    const size=Buffer.byteLength(JSON.stringify(value));if(size>2*1024*1024)return;
    const old=this.entries.get(key);if(old)this.bytes-=old.size;this.entries.delete(key);
    this.entries.set(key,{value,at,size});this.bytes+=size;
    while(this.entries.size>this.maxEntries||this.bytes>this.maxBytes){const k=this.entries.keys().next().value;this.bytes-=this.entries.get(k).size;this.entries.delete(k);}
    if(persist&&this.directory&&!this.timer){this.timer=setTimeout(()=>{this.timer=null;this.persist();},2000);this.timer.unref();}
  }
  async persist(){
    clearTimeout(this.timer);this.timer=null;if(!this.directory)return;
    const snapshot=JSON.stringify([...this.entries].map(([k,e])=>[k,{at:e.at,value:e.value}]));
    let stage='mkdir';
    this.pending=this.pending.catch(()=>{}).then(async()=>{await mkdir(this.directory,{recursive:true});const tmp=resolve(this.directory,'catalog-pages.tmp');stage='write';await writeFile(tmp,snapshot,{mode:0o600});stage='rename';await rename(tmp,resolve(this.directory,'catalog-pages.json'));this.persistenceError=null;}).catch(e=>{this.persistenceError=stage+':'+(e.code||'write_failed');});
    await this.pending;
  }
}

export class NetflixCatalog {
  constructor(config,{fetcher=fetch,cache=new PageCache(),timeoutMs=8000,maxConcurrent=3,maxQueue=128,pageSize=8}={}){
    Object.assign(this,{config,fetcher,cache,timeoutMs,maxConcurrent,maxQueue,pageSize});
    this.flights=new Map();this.active=0;this.queue=[];this.token='';this.authKind='';this.generation=0;
    this.metrics={upstream:0,cacheHits:0,staleHits:0,deduplicated:0,failures:0,peak:0};
  }
  manifest(){return{id:'community.nuvio.serviceshelves.us',version:'0.1.0',name:'Service Shelves — US',description:'Service-specific shelves with original saved filters, small pages and cached results. Full categories open with the client’s category action.',resources:['catalog'],types:['movie','series'],catalogs:this.config.feeds.map(f=>({id:f.id,type:f.type,name:f.name,pageSize:this.pageSize,showInHome:false,extra:[{name:'skip',isRequired:false}]}))};}
  async setCredential(token,kind){
    if(!['token','key'].includes(kind)||typeof token!=='string'||token.length<16||token.length>4096||/[\s\r\n]/.test(token))throw new CatalogError(400,'bad_credential','Enter a TMDB read token or API key.');
    // Validate at the actual provider before changing the working in-memory credential.
    const u=new URL('https://api.themoviedb.org/3/authentication');const h={Accept:'application/json'};
    if(kind==='token')h.Authorization='Bearer '+token;else u.searchParams.set('api_key',token);
    const verified=await this.upstream(u,h);
    if(verified.success!==true)throw new CatalogError(401,'provider_error','TMDB did not confirm this credential.');
    this.token=token;this.authKind=kind;this.generation++;
  }
  async limited(fn){
    if(this.active>=this.maxConcurrent){if(this.queue.length>=this.maxQueue)throw new CatalogError(503,'busy','Catalog queue is full; retry shortly.');await new Promise((resolve,reject)=>{const resume=()=>{clearTimeout(timer);resolve();};const timer=setTimeout(()=>{const i=this.queue.indexOf(resume);if(i>=0)this.queue.splice(i,1);reject(new CatalogError(503,'busy','Catalog queue timed out; retry shortly.'));},this.timeoutMs);this.queue.push(resume);});}else this.active++;
    this.metrics.peak=Math.max(this.metrics.peak,this.active);
    try{return await fn();}finally{const next=this.queue.shift();if(next)next();else this.active--;}
  }
  async upstream(url,headers={Accept:'application/json'}){
    return this.limited(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
      this.metrics.upstream++;
      try{
        const r=await this.fetcher(url,{headers,signal:controller.signal,redirect:'error'});
        if(!r.ok)throw new CatalogError(r.status===401||r.status===403?401:502,'provider_error',r.status===401||r.status===403?'TMDB rejected the credential.':'TMDB is temporarily unavailable.');
        const reader=r.body.getReader(),parts=[];let size=0;
        while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2*1024*1024){controller.abort();await reader.cancel();throw new CatalogError(502,'large_response','Provider response exceeded its limit.');}parts.push(value);}
        try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new CatalogError(502,'invalid_provider','TMDB returned invalid JSON.');}
      }catch(e){this.metrics.failures++;if(e instanceof CatalogError)throw e;throw new CatalogError(504,'provider_timeout','TMDB did not respond in time.');}finally{clearTimeout(timer);}
    });
  }
  async page(feed,page){
    // Require a current credential even for disk-cache hits, so setup status is unambiguous.
    if(!this.token)throw new CatalogError(503,'setup_required','The server administrator must configure a TMDB credential.');
    const u=buildUrl(feed,page,this.config),key=hash(u.href),old=await this.cache.get(key);
    const generation=this.generation,token=this.token,kind=this.authKind;
    const flightKey=key+':'+generation;
    const refresh=()=>{
      if(this.flights.has(flightKey)){this.metrics.deduplicated++;return this.flights.get(flightKey);}
      const p=(async()=>{
        const headers={Accept:'application/json'};
        if(kind==='token')headers.Authorization='Bearer '+token;else u.searchParams.set('api_key',token);
        const data=await this.upstream(u,headers);
        if(!Array.isArray(data.results)||data.results.length>20||!data.results.every(v=>Number.isInteger(v.id)&&v.id>0&&typeof(v.title||v.name)==='string'))throw new CatalogError(502,'invalid_catalog','Invalid provider items; refusing to shift pagination offsets.');
        const value={results:data.results,total_pages:data.total_pages};
        if(this.generation===generation)this.cache.put(key,value);
        return value;
      })().finally(()=>this.flights.delete(flightKey));this.flights.set(flightKey,p);return p;
    };
    if(old&&!old.stale){this.metrics.cacheHits++;return{data:old.value,state:'hit',age:old.age};}
    if(old){this.metrics.staleHits++;refresh().catch(()=>{});return{data:old.value,state:'stale',age:old.age};}
    return{data:await refresh(),state:'miss',age:0};
  }
  async catalog(type,id,extra=''){
    const feed=this.config.feeds.find(f=>f.id===id&&f.type===type);
    if(!feed)throw new CatalogError(404,'unknown_catalog','Unknown service catalog.');
    if(extra.length>128)throw new CatalogError(400,'bad_extra','Invalid pagination.');
    const params=new URLSearchParams(extra),entries=[...params];
    if(entries.some(([k])=>k!=='skip')||entries.length>1)throw new CatalogError(400,'bad_extra','Only one skip parameter is accepted.');
    const raw=params.get('skip')||'0';if(!/^\d+$/.test(raw)||Number(raw)>10000)throw new CatalogError(400,'bad_skip','Invalid pagination offset.');
    const skip=Number(raw);if(skip>=10000)return{body:{metas:[]},state:'end',age:0};
    const page=Math.floor(skip/20)+1,offset=skip%20,result=await this.page(feed,page);
    const metas=result.data.results.slice(offset,Math.min(20,offset+this.pageSize)).map(v=>{
      const date=v.release_date||v.first_air_date||'';
      return{id:'tmdb:'+v.id,type,name:v.title||v.name,poster:v.poster_path?'https://image.tmdb.org/t/p/w342'+v.poster_path:undefined,posterShape:'poster',background:v.backdrop_path?'https://image.tmdb.org/t/p/w1280'+v.backdrop_path:undefined,description:v.overview||undefined,releaseInfo:date.slice(0,4)};
    });
    return{body:{metas},state:result.state,age:result.age};
  }
  stats(){return{configured:Boolean(this.token),pageSize:this.pageSize,categories:this.config.feeds.length,entries:this.cache.entries.size,cacheBytes:this.cache.bytes,active:this.active,queued:this.queue.length,...this.metrics};}
}
