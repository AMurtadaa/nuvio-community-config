(function(root){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x));
 function build({collections,home,appearance,profileId,topxAddonId='',includeHome=false,includeTvAppearance=false,includeBetterPosters=false}){
  if(!Number.isSafeInteger(profileId)||profileId<1)throw Error('Enter the positive whole-number profileId from your own Studio backup.');
  topxAddonId=topxAddonId.trim();
  if(topxAddonId&&!/^com\.topx\.[a-zA-Z0-9_-]{4,80}$/.test(topxAddonId))throw Error('TopX needs its manifest ID, such as com.topx.YOUR_ID, not its URL or a secret key.');
  if(!Array.isArray(collections)||collections.length!==19||collections.some(c=>!c.id?.startsWith('community-collection-')||!Array.isArray(c.folders)))throw Error('Choose config/collections.template.json from this simple-config branch, not your private backup or the hosted package.');
  let cols=copy(collections),omitted=0;
  for(const c of cols){c.folders=c.folders.filter(f=>{
   const original=f.sources.length;
   f.sources=f.sources.filter(s=>{
    const keep=!(s.addonId==='__TOPX_ADDON_ID__'&&!topxAddonId)&&!(s.addonId==='community.betterposters'&&!includeBetterPosters);
    if(!keep)omitted++;else if(s.addonId==='__TOPX_ADDON_ID__')s.addonId=topxAddonId;return keep;
   });
   f.catalogSources=f.sources.filter(s=>s.provider==='addon').map(s=>({type:s.type,addonId:s.addonId,catalogId:s.catalogId}));
   return f.sources.length>0||original===0;
  });}
  cols=cols.filter(c=>c.folders.length>0);
  if(cols.some(c=>c.title==='More Browsing'))throw Error('Unexpected More Browsing collection. Download the simple-config branch again.');
  if(cols.some(c=>c.folders.some(f=>f.sources.some(s=>s.addonId==='community.nuvio.serviceshelves.us'))))throw Error('Hosted addon references are not allowed in this package.');
  const parts={collections:cols};
  if(includeHome){const h=copy(home),ids=new Set(cols.map(c=>c.id));h.items=h.items.filter(r=>r.is_collection?ids.has(r.collection_id):Boolean(topxAddonId));
   for(const [i,r] of h.items.entries()){if(r.addon_id==='__TOPX_ADDON_ID__'){r.addon_id=topxAddonId;r.key=r.key.replace('__TOPX_ADDON_ID__',topxAddonId);}r.order=i;}parts.home=h;
  }
  if(includeTvAppearance)parts.settings=copy(appearance);
  const sources=cols.flatMap(c=>c.folders.flatMap(f=>f.sources));
  return{collections:cols,profile:{format:'kaptain-profile-backup',formatVersion:1,label:'Simple Nuvio service folders - no VM',profileId,parts},summary:{collections:cols.length,folders:cols.flatMap(c=>c.folders).length,sources:sources.length,omittedOptionalSources:omitted,services:cols.find(c=>c.title==='Streaming Services').folders.length,topxEnabled:Boolean(topxAddonId),homeIncluded:includeHome,tvAppearanceIncluded:includeTvAppearance}};
 }
 root.NuvioSimplePreset={build};
})(typeof window==='undefined'?globalThis:window);
