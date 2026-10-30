/* Offline-only recovery logic. Never installs addons or service credentials. */
(function(root){
  'use strict';
  const placeholder=/(?:redacted|your[_ -]?(?:api[_ -]?)?(?:key|token)|placeholder|replace[_ -]?me)/i;
  const secretName=/(?:api.?key|token|password|secret|credential|authorization)/i;
  const groups=new Set(['layout_settings','theme_settings','trailer_settings','stream_badge_settings','poster_card_style_settings_payload','card_depth_style_settings_payload','collection_mobile_settings_payload','meta_screen_settings_payload','custom_poster_enabled_screens']);
  const clone=x=>JSON.parse(JSON.stringify(x));
  function clean(value){
    if(Array.isArray(value))return value.map(clean);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!secretName.test(k)&&!['__proto__','constructor','prototype'].includes(k)).map(([k,v])=>[k,clean(v)]));
    if(typeof value==='string'){
      if(placeholder.test(value))throw Error('A placeholder was found in the layout or appearance. No file was created.');
      if(/(?:realdebrid|all.?debrid|apikey|api_key|access_token|password|authorization)\s*[=:]/i.test(value))throw Error('A credential-like value was found outside the addon list. No file was created.');
    }
    return value;
  }
  function inspect(backup){
    if(!backup||backup.format!=='kaptain-profile-backup'||backup.formatVersion!==1||!backup.parts||!Array.isArray(backup.parts.collections)||!backup.parts.collections.length)throw Error('Choose a Kaptain profile backup containing collections (format version 1).');
    const collections=backup.parts.collections;
    if(collections.some(c=>!c||typeof c.id!=='string'||!Array.isArray(c.folders)||c.folders.some(f=>!f||typeof f.id!=='string'||!Array.isArray(f.sources))))throw Error('The collection structure is incomplete. Export a fresh backup containing collections.');
    if(new Set(collections.map(c=>c.id)).size!==collections.length)throw Error('Duplicate collection IDs: use a fresh working backup.');
    const addons=Array.isArray(backup.parts.addons)?backup.parts.addons:[];
    const excluded=addons.filter(a=>placeholder.test(a.url||''));
    const localhost=addons.some(a=>/https?:\/\/(?:127\.0\.0\.1|localhost)(?=[:/])/i.test(a.url||'')&&a.enabled!==false);
    const sources=collections.flatMap(c=>c.folders.flatMap(f=>f.sources));
    return {collections:collections.length,folders:collections.reduce((n,c)=>n+c.folders.length,0),sources:sources.length,addonCount:addons.length,redactedAddonCount:excluded.length,enabledLocalhost:localhost,requiresTmdb:sources.some(s=>s.provider==='tmdb'),requiresTrakt:sources.some(s=>s.provider==='trakt'),addonIds:[...new Set(sources.map(s=>s.addonId).filter(Boolean))]};
  }
  function build(backup,{profileId,includeHome=false,includeAppearance=false,confirmed=false}={}){
    const summary=inspect(backup);
    if(!Number.isInteger(profileId)||profileId<1||profileId>6)throw Error('Enter the target profile ID, a whole number from 1 to 6.');
    if(!confirmed)throw Error('Confirm the target profile and the replacement warning first.');
    const parts={collections:clean(clone(backup.parts.collections))};
    if(includeHome){if(!backup.parts.home||!Array.isArray(backup.parts.home.items))throw Error('This backup has no supported Home order. Leave Home unchecked.');parts.home=clean(clone(backup.parts.home));}
    if(includeAppearance){
      const settings={};
      for(const platform of ['tv','mobile','desktop']){
        const src=backup.parts.settings?.[platform];if(!src?.features)continue;
        const features={};
        for(const [key,value]of Object.entries(src.features)){
          if(groups.has(key))features[key]=clean(clone(value));
          if(key==='custom_poster_url_pattern'&&typeof value==='string'&&(/^https:\/\/btttr\.cc\/poster-q\/imdb\/poster-default\/\{imdb_id\}\.jpg\?rs=IM$/.test(value)||/^https:\/\/[a-z0-9.-]+(?::\d+)?\/posters\/v1\/\{imdb_id\}\.webp$/i.test(value)))features[key]=value;
        }
        if(Object.keys(features).length)settings[platform]={version:src.version||1,features};
      }
      if(Object.keys(settings).length)parts.settings=settings;
    }
    return {summary,profile:{format:'kaptain-profile-backup',formatVersion:1,label:'Safe layout recovery — reconnect services separately',profileId,parts}};
  }
  const api={inspect,build};if(typeof module==='object'&&module.exports)module.exports=api;else root.NuvioRecovery=api;
})(typeof globalThis!=='undefined'?globalThis:this);
