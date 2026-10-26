import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const config=JSON.parse(await readFile(new URL('worker/config.json',root),'utf8'));
const template=await readFile(new URL('worker/index.template.js',root),'utf8');
const worker=template.replace('__HUB_CONFIG__',JSON.stringify(config)).replace('__SERVICE_NAMES__',JSON.stringify(config.services.map(({id,name})=>({id,name}))));
await writeFile(new URL('worker/index.js',root),worker);
await mkdir(new URL('dist/server/',root),{recursive:true});
await writeFile(new URL('dist/server/index.js',root),worker);
console.log('Built catalog Worker; no hosting account required to build.');
