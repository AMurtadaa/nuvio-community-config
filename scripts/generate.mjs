import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import './preset.js';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
export async function makePreset(options){return globalThis.NuvioSimplePreset.build({...options,collections:await read('config/collections.template.json'),home:await read('config/home.template.json'),appearance:await read('config/tv-appearance.json')});}
export async function main(args=process.argv.slice(2)){
 if(args.includes('--help')){console.log('node scripts/generate.mjs --profile-id 1 [--topx-addon-id com.topx.YOUR_ID] [--include-betterposters] [--include-home] [--include-tv-appearance] [--out generated]');return;}
 const o={};for(let i=0;i<args.length;i++){const k=args[i];if(['--include-home','--include-tv-appearance','--include-betterposters'].includes(k)){o[k]=true;continue;}if(!['--profile-id','--topx-addon-id','--out'].includes(k)||!args[i+1]||args[i+1].startsWith('--')||o[k]!==undefined)throw Error('Unknown, duplicate or incomplete argument: '+k);o[k]=args[++i];}
 const result=await makePreset({profileId:Number(o['--profile-id']),topxAddonId:o['--topx-addon-id']||'',includeHome:!!o['--include-home'],includeTvAppearance:!!o['--include-tv-appearance'],includeBetterPosters:!!o['--include-betterposters']});
 const out=resolve(o['--out']||fileURLToPath(new URL('generated/',root)));await mkdir(out,{recursive:true});
 for(const [name,value] of [['studio-import.json',result.profile],['collections.json',result.collections]])await writeFile(resolve(out,name),JSON.stringify(value,null,2)+'\n',{encoding:'utf8',flag:'wx'});
 console.log(JSON.stringify(result.summary,null,2));console.log('Saved imports to '+out+'. Back up before restoring; collections replace the target profile collection list.');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(e=>{console.error(e.message);process.exitCode=1;});
