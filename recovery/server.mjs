import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
const root=dirname(fileURLToPath(import.meta.url));
const folder=resolve(process.argv[2]||'private/nuvio-recovery');
const vaultPath=resolve(folder,'private-backup.vault');
if(process.platform!=='win32')throw Error('This local vault uses Windows encryption. Use Windows with the same user account.');
await mkdir(folder,{recursive:true});
function vault(mode,input=''){
  return new Promise((ok,fail)=>{
    const p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-File',resolve(root,'windows-vault.ps1'),'-Mode',mode,'-Path',vaultPath],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let out='',size=0;p.stdout.on('data',c=>{size+=c.length;if(size>32*1024*1024){p.kill();fail(Error('Vault too large.'));}else out+=c;});
    p.stderr.resume();p.on('error',()=>fail(Error('Cannot start Windows vault helper.')));p.on('close',code=>code===0?ok(out):fail(Error('Cannot open/save the vault. Use the original Windows account and an intact file.')));p.stdin.end(input);
  });
}
let data;
try{data=JSON.parse(await vault('Open'));}catch(e){throw Error('No usable private backup at the selected folder. Create/seal a seed first.');}
const token=randomBytes(32).toString('hex');
let origin='';let writing=false;
const send=(res,status,value,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});res.end(type==='application/json'?JSON.stringify(value):value);};
const files={'/':['vault.html','text/html; charset=utf-8'],'/vault.js':['vault.js','text/javascript; charset=utf-8'],'/crypto.cjs':['crypto.cjs','text/javascript; charset=utf-8'],'/vault.css':['vault.css','text/css; charset=utf-8']};
const server=http.createServer(async(req,res)=>{
  try{
    if(req.headers.host!==new URL(origin).host)return send(res,403,{error:'Wrong host.'});
    const path=new URL(req.url,origin).pathname;
    if(files[path]&&req.method==='GET'){const [file,type]=files[path];return send(res,200,await readFile(resolve(root,file),'utf8'),type);}
    if(req.headers.authorization!==`Bearer ${token}`||req.headers.origin&&req.headers.origin!==origin)return send(res,403,{error:'Unlock link required. Reopen the link from the launcher.'});
    if(path==='/api/state'&&req.method==='GET')return send(res,200,data);
    if(path==='/api/save'&&req.method==='POST'){
      if(writing)return send(res,409,{error:'A save is already running.'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>32000)return send(res,413,{error:'Too large.'});}
      const update=JSON.parse(body);const tmdb=String(update.tmdb||'').trim();
      if(tmdb&&!/^[a-f0-9]{32}$/i.test(tmdb))return send(res,400,{error:'TMDB needs its 32-character API Key (v3 auth), not a read-access token.'});
      const next={...data,credentials:{...data.credentials,tmdb},updatedAt:new Date().toISOString()};
      writing=true;try{await vault('Seal',JSON.stringify(next));data=next;}finally{writing=false;}
      return send(res,200,{saved:true,tmdbSaved:!!tmdb});
    }
    return send(res,404,{error:'Not found.'});
  }catch{send(res,500,{error:'Operation failed. No credentials are included in this error.'});}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
origin=`http://127.0.0.1:${server.address().port}`;
// The random unlock fragment remains local and is not an account credential.
await writeFile(resolve(folder,'open-helper.url'),`[InternetShortcut]\r\nURL=${origin}/#${token}\r\n`);
console.log(`Local helper ready. Open: ${resolve(folder,'open-helper.url')}`);
console.log('Windows-user encrypted; only loopback is listening. Close this process when finished.');
const stop=()=>server.close(()=>process.exit(0));process.on('SIGINT',stop);process.on('SIGTERM',stop);
