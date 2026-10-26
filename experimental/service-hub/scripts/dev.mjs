import http from 'node:http';
import worker from '../worker/index.js';
const env={TMDB_READ_ACCESS_TOKEN:process.env.TMDB_READ_ACCESS_TOKEN,TMDB_API_KEY:process.env.TMDB_API_KEY,TRAKT_CLIENT_ID:process.env.TRAKT_CLIENT_ID,ALLOW_PUBLIC_PREVIEW:process.env.ALLOW_PUBLIC_PREVIEW||'true'};
const port=Number(process.env.PORT||8787);
const server=http.createServer(async(req,res)=>{try{const r=await worker.fetch(new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:req.headers}),env,{waitUntil:p=>p.catch(()=>{})});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(500);res.end('Preview unavailable');}});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
