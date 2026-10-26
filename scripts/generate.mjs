import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=new URL('../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));

export async function makePreset({topxAddonId,profileId,includeHome=false}) {
  if(!/^com\.topx\.[a-zA-Z0-9_-]{4,80}$/.test(topxAddonId||''))throw new Error('Supply your own com.topx.* manifest ID, not a URL or API key.');
  if(!Number.isSafeInteger(profileId)||profileId<1)throw new Error('Supply the positive numeric profileId from your own Studio backup.');
  const collections=JSON.parse(JSON.stringify(await read('config/collections.template.json')).replaceAll('__TOPX_ADDON_ID__',topxAddonId));
  const settings=await read('config/tv-appearance.json');
  const parts={collections,settings};
  if(includeHome)parts.home=JSON.parse(JSON.stringify(await read('config/home.template.json')).replaceAll('__TOPX_ADDON_ID__',topxAddonId));
  return {collections,profile:{format:'kaptain-profile-backup',formatVersion:1,label:'Nuvio community US collections and TV appearance',profileId,parts}};
}
export async function main(args=process.argv.slice(2)) {
  if(args.includes('--help')){console.log('node scripts/generate.mjs --topx-addon-id com.topx.YOUR_ID --profile-id 1 [--include-home] [--out generated]');return;}
  const options={};
  for(let i=0;i<args.length;i++){
    const k=args[i];if(k==='--include-home'){options.includeHome=true;continue;}
    if(!['--topx-addon-id','--profile-id','--out'].includes(k)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Unknown or incomplete argument: '+k);
    if(options[k]!==undefined)throw new Error('Duplicate argument: '+k);options[k]=args[++i];
  }
  const result=await makePreset({topxAddonId:options['--topx-addon-id'],profileId:Number(options['--profile-id']),includeHome:options.includeHome});
  const out=resolve(options['--out']||fileURLToPath(new URL('generated',root)));
  await mkdir(out,{recursive:true});
  // Refuse overwrites so a previously generated or hand-edited import is preserved.
  for(const [name,value] of [['collections.json',result.collections],['studio-import.json',result.profile]])await writeFile(resolve(out,name),JSON.stringify(value,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  console.log('Created collections.json and studio-import.json in '+out+'. Back up the target profile before importing.');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(e=>{console.error(e.message);process.exitCode=1;});
