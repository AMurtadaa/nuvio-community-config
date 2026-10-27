import http from 'node:http';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {CatalogError,NetflixCatalog,PageCache} from './core.mjs';

export async function createServer({port=8790,fetcher=fetch,cacheDirectory=fileURLToPath(new URL('private/cache/',import.meta.url)),secretFile=null,catalogOptions={}}={}){
 const config=JSON.parse(await readFile(new URL('feeds.json',import.meta.url),'utf8'));
 const cache=new PageCache({directory:cacheDirectory,maxEntries:1024,maxBytes:32*1024*1024});await cache.restore();
 const catalog=new NetflixCatalog(config,{fetcher,cache,...catalogOptions}),csrf=randomBytes(24).toString('hex');
 let startupCredentialError=false;
 // This file was validated when saved. Do not require TMDB to be online at boot:
 // a temporary provider outage must not prevent serving the surviving cache.
 if(secretFile){try{const secret=JSON.parse(await readFile(secretFile,'utf8'));if(!['token','key'].includes(secret.kind)||typeof secret.credential!=='string'||secret.credential.length<16||secret.credential.length>4096||/\s/.test(secret.credential))throw Error('invalid_secret');catalog.token=secret.credential;catalog.authKind=secret.kind;}catch(e){if(e.code!=='ENOENT')startupCredentialError=true;}}
 const server=http.createServer(async(req,res)=>{
  const host=req.headers.host||'',expected=['127.0.0.1:'+server.address().port,'localhost:'+server.address().port];
  const origin='http://'+host;
  const send=(body,status=200,extra={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...extra});res.end(req.method==='HEAD'?'':JSON.stringify(body));};
  try{
   if(!expected.includes(host))throw new CatalogError(403,'bad_host','Use the local SSH tunnel.');
   if((req.url||'').length>512)throw new CatalogError(414,'too_long','Request URL is too long.');
   const u=new URL(req.url,origin);
   if(u.search)throw new CatalogError(400,'bad_query','Use protocol path pagination.');
   const publicRoute=u.pathname==='/manifest.json'||u.pathname.startsWith('/catalog/');
   if(req.method==='OPTIONS'&&publicRoute){send({},204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS'});return;}
   if(req.method==='POST'&&u.pathname==='/setup'){
    if(req.headers.origin!==origin)throw new CatalogError(403,'bad_origin','Use the private setup page.');
    if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type']||''))throw new CatalogError(415,'bad_content','Use the setup form.');
    let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>8192)throw new CatalogError(413,'too_large','Setup input is too large.');}
    const p=new URLSearchParams(data);if(p.get('csrf')!==csrf)throw new CatalogError(403,'bad_csrf','Reload this page.');
    const credential=p.get('credential')||'',kind=p.get('kind')||'token';
    await catalog.setCredential(credential,kind);
    if(secretFile){await mkdir(dirname(secretFile),{recursive:true,mode:0o700});await writeFile(secretFile+'.tmp',JSON.stringify({credential,kind}),{mode:0o600});await rename(secretFile+'.tmp',secretFile);}
    startupCredentialError=false;send({ok:true,message:'Connected. Credential is stored privately on your VM.'});return;
   }
   if(!['GET','HEAD'].includes(req.method))throw new CatalogError(405,'method_not_allowed','Unsupported method.');
   if(u.pathname==='/health.json'){send({...catalog.stats(),startupCredentialError,persistenceError:cache.persistenceError||null});return;}
   if(u.pathname==='/'||u.pathname==='/configure'){
    const page=(await readFile(new URL('setup.html',import.meta.url),'utf8')).replaceAll('__CSRF__',csrf);
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${csrf}'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`});res.end(req.method==='HEAD'?'':page);return;
   }
   const cors={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'X-Catalog-Cache, X-Cache-Age-Seconds'};
   if(u.pathname==='/manifest.json'){send(catalog.manifest(),200,{...cors,'Cache-Control':'public, max-age=60'});return;}
   const m=u.pathname.match(/^\/catalog\/(movie|series)\/([a-z0-9-]+)(?:\/([^/]*))?\.json$/);
   if(!m)throw new CatalogError(404,'not_found','Unknown route.');
   const result=await catalog.catalog(m[1],m[2],m[3]||'');send(result.body,200,{...cors,'Cache-Control':result.state==='stale'?'no-cache':'public, max-age=60','X-Catalog-Cache':result.state,'X-Cache-Age-Seconds':String(Math.floor(result.age/1000))});
  }catch(e){send({error:e instanceof CatalogError?e.code:'internal_error',message:e instanceof CatalogError?e.message:'The request could not be completed.'},e instanceof CatalogError?e.status:500,{'Access-Control-Allow-Origin':'*'});}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=32;
 await new Promise((r,j)=>{server.once('error',j);server.listen(port,'127.0.0.1',r);});
 return{server,catalog,csrf,url:'http://127.0.0.1:'+server.address().port,close:async()=>{await new Promise(r=>server.close(r));await cache.persist();}};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const app=await createServer({port:Number(process.env.PORT||8790),cacheDirectory:process.env.CACHE_DIRECTORY||'private/cache',secretFile:process.env.TMDB_SECRET_FILE||'private/tmdb.json'});
 console.log('Service Shelves listening on loopback; setup is available only through SSH.');
 let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;await app.close();process.exit(0);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
