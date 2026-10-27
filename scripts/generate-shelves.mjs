import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {makePreset} from './generate.mjs';
const root=new URL('../',import.meta.url),addonId='community.nuvio.serviceshelves.us';
const nonNull=v=>Array.isArray(v)?v.map(nonNull):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([,x])=>x!==null).map(([k,x])=>[k,nonNull(x)])):v;
export async function makeShelvesPreset({topxAddonId,profileId,addonUrl,includeHome=false}){
 const url=new URL(addonUrl);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/manifest.json')throw Error('Use your own public HTTPS /manifest.json address, without credentials or query parameters.');
 const base=await makePreset({topxAddonId,profileId,includeHome});
 const config=JSON.parse(await readFile(new URL('addons/service-shelves/feeds.json',root),'utf8'));
 const mapping=JSON.parse(await readFile(new URL('addons/service-shelves/restore-map.json',root),'utf8'));
 const collections=base.collections,folders=new Map(collections.flatMap(c=>c.folders).map(f=>[f.id,f]));
 const moved=new Set();
 for(const m of mapping){const target=folders.get(m.folderId),chunk=folders.get(m.overflowFolderId);assert.ok(target&&chunk,'Restoration mapping does not match templates');target.sources.push(...chunk.sources);moved.add(chunk.id);}
 const more=collections.find(c=>c.title==='More Browsing');assert.ok(more&&more.folders.every(f=>moved.has(f.id)),'Unmapped overflow folders');
 const retained=collections.filter(c=>c!==more);let converted=0;
 for(const service of config.services){const folder=folders.get(service.folderId);assert.equal(folder.sources.length,service.originalSources);
  for(const feed of config.feeds.filter(f=>f.serviceId===service.id)){
   const s=folder.sources[Number(feed.id.split('-').at(-1))];assert.ok(s&&s.provider==='tmdb'&&s.tmdbSourceType==='DISCOVER');
   for(const [key,value] of Object.entries(feed.source))assert.deepEqual(nonNull(s[key]??null),value,'Saved filter mismatch: '+feed.id+' '+key);
   Object.assign(s,{provider:'addon',type:feed.type,addonId,catalogId:feed.id,genre:null,mediaType:null,tmdbId:null,tmdbSourceType:null,filters:null,sortBy:null,sortHow:null,traktListId:null});converted++;
  }
 }
 for(const c of retained)for(const f of c.folders)f.catalogSources=structuredClone(f.sources);
 assert.equal(converted,709);assert.equal(retained.flatMap(c=>c.folders).length,786);assert.equal(retained.flatMap(c=>c.folders.flatMap(f=>f.sources)).length,3612);
 const parts={collections:retained};
 if(includeHome){const home=base.profile.parts.home;home.items=home.items.filter(r=>r.collection_id!==more.id);
  for(const feed of config.feeds)home.items.push({key:`${addonId}:${feed.type}:${feed.id}`,type:feed.type,order:0,enabled:false,addon_id:addonId,catalog_id:feed.id,custom_title:'',collection_id:'',is_collection:false});
  home.items.forEach((r,i)=>r.order=i);parts.home=home;
 }
 return{collections:retained,profile:{format:'kaptain-profile-backup',formatVersion:1,label:'Service Shelves - cached service folders',profileId,parts},installation:{manifestUrl:url.href,manifestId:addonId}};
}
export async function main(args=process.argv.slice(2)){
 if(args.includes('--help')){console.log('node scripts/generate-shelves.mjs --topx-addon-id com.topx.YOUR_ID --profile-id 1 --addon-url https://YOUR_HOST/manifest.json [--include-home] [--out generated/shelves]');return;}
 const o={};for(let i=0;i<args.length;i++){const k=args[i];if(k==='--include-home'){o.includeHome=true;continue;}if(!['--topx-addon-id','--profile-id','--addon-url','--out'].includes(k)||!args[i+1]||args[i+1].startsWith('--')||o[k]!==undefined)throw Error('Unknown, duplicate or incomplete argument: '+k);o[k]=args[++i];}
 const p=await makeShelvesPreset({topxAddonId:o['--topx-addon-id'],profileId:Number(o['--profile-id']),addonUrl:o['--addon-url'],includeHome:o.includeHome});
 const out=resolve(o['--out']||fileURLToPath(new URL('generated/shelves',root)));await mkdir(out,{recursive:true});
 for(const [name,value] of [['collections.json',p.collections],['studio-import.json',p.profile],['installation.json',p.installation]])await writeFile(resolve(out,name),JSON.stringify(value,null,2)+'\n',{encoding:'utf8',flag:'wx'});
 console.log('Created presets in '+out+'. Install your addon separately using '+p.installation.manifestUrl+'. Back up before importing; collections are replaced, not merged.');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(e=>{console.error(e.message);process.exitCode=1;});
