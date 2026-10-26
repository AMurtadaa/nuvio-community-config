import test from 'node:test';
import assert from 'node:assert/strict';
import {makePreset} from '../scripts/generate.mjs';
test('default import excludes addons, playback and Home while connecting own TopX sources',async()=>{
 const p=await makePreset({topxAddonId:'com.topx.test1234',profileId:7});
 assert.equal(p.profile.profileId,7);assert.deepEqual(Object.keys(p.profile.parts),['collections','settings']);
 assert.equal(p.collections.flatMap(c=>c.folders.flatMap(f=>f.sources)).filter(s=>s.addonId==='com.topx.test1234').length,20);
 assert.ok(!JSON.stringify(p).includes('__TOPX_ADDON_ID__'));
 assert.deepEqual(Object.keys(p.profile.parts.settings.tv.features),['layout_settings']);
});
test('opt-in Home has correct rank rows and stable collection references',async()=>{
 const p=await makePreset({topxAddonId:'com.topx.test1234',profileId:1,includeHome:true});
 const home=p.profile.parts.home.items;
 assert.deepEqual(home.filter(i=>i.enabled).slice(0,3).map(i=>i.catalog_id||i.custom_title),['jw.us.topx.movie','jw.us.topx.series','Streaming Services']);
 const ids=new Set(p.collections.map(c=>c.id));assert.ok(home.filter(i=>i.is_collection).every(i=>ids.has(i.collection_id)));
 assert.ok(home.filter(i=>!i.is_collection).every(i=>i.addon_id==='com.topx.test1234'));
});
test('reject URLs, keys and invalid profile selection',async()=>{
 for(const id of ['https://example.com/manifest.json','secret','com.topx.abc/../../x']){
  await assert.rejects(makePreset({topxAddonId:id,profileId:1}));
 }
 for(const profileId of [undefined,0,-1,1.2,Infinity])await assert.rejects(makePreset({topxAddonId:'com.topx.test1234',profileId}));
});
