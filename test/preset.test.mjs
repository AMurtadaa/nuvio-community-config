import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makePreset} from '../scripts/generate.mjs';
const template=JSON.parse(await readFile(new URL('../config/collections.template.json',import.meta.url),'utf8'));
const all=cols=>cols.flatMap(c=>c.folders.flatMap(f=>f.sources));
test('complete native package retains every original source and all restored service categories',async()=>{
 const p=await makePreset({profileId:7,topxAddonId:'com.topx.test1234',includeBetterPosters:true});
 assert.equal(p.collections.length,19);assert.equal(p.summary.folders,786);assert.equal(p.summary.sources,3612);assert.equal(p.summary.omittedOptionalSources,0);
 assert.ok(!p.collections.some(c=>c.title==='More Browsing'));const service=p.collections.find(c=>c.title==='Streaming Services');assert.equal(service.folders.length,22);assert.equal(all([service]).length,741);assert.ok(service.folders.every(f=>f.focusGifEnabled));assert.equal(service.folders.find(f=>f.title==='Netflix').sources.length,51);
 assert.deepEqual(Object.keys(p.profile.parts),['collections']);assert.equal(p.profile.profileId,7);
 const expected=JSON.parse(JSON.stringify(template).replaceAll('__TOPX_ADDON_ID__','com.topx.test1234'));
 assert.deepEqual(all(p.collections),all(expected),'Native source filters, ordering, metadata and IDs must remain unchanged');
 assert.ok(!JSON.stringify(p).includes('community.nuvio.serviceshelves.us'));
});
test('basic setup works without TopX or BetterPosters and removes only the optional source references',async()=>{
 const p=await makePreset({profileId:1});assert.equal(p.summary.services,22);assert.equal(p.summary.sources,3590);assert.equal(p.summary.omittedOptionalSources,22);
 assert.ok(all(p.collections).every(s=>!['__TOPX_ADDON_ID__','community.betterposters'].includes(s.addonId)));assert.equal(p.collections.find(c=>c.title==='Streaming Services').folders.length,22);
 assert.deepEqual(all(p.collections),all(template).filter(s=>!['__TOPX_ADDON_ID__','community.betterposters'].includes(s.addonId)));
});
test('optional Home puts charts first or services first and never references removed collections',async()=>{
 for(const topxAddonId of ['','com.topx.test1234']){const p=await makePreset({profileId:1,topxAddonId,includeHome:true});const home=p.profile.parts.home.items,ids=new Set(p.collections.map(c=>c.id));assert.ok(home.filter(r=>r.is_collection).every(r=>ids.has(r.collection_id)));
  assert.deepEqual(home.filter(r=>r.enabled).slice(0,topxAddonId?3:1).map(r=>r.catalog_id||r.custom_title),topxAddonId?['jw.us.topx.movie','jw.us.topx.series','Streaming Services']:['Streaming Services']);
 }
});
test('TV settings are an explicit opt-in and include only the appearance group',async()=>{
 const p=await makePreset({profileId:1,includeTvAppearance:true});assert.deepEqual(Object.keys(p.profile.parts.settings),['tv']);assert.deepEqual(Object.keys(p.profile.parts.settings.tv.features),['layout_settings']);assert.equal(p.profile.parts.settings.tv.features.layout_settings.hero_section_enabled.value,true);assert.ok(!('addons' in p.profile.parts));
});
test('rejects invalid profile IDs and URLs or secrets entered in place of a TopX ID',async()=>{
 for(const profileId of [undefined,0,-1,1.5,Infinity])await assert.rejects(makePreset({profileId}));
 for(const topxAddonId of ['https://example.com/manifest.json','a-secret','com.topx.bad/id'])await assert.rejects(makePreset({profileId:1,topxAddonId}));
});
test('browser and CLI use the same builder and public defaults',async()=>{
 const defaults=await readFile(new URL('../scripts/defaults.js',import.meta.url),'utf8'),d=JSON.parse(defaults.trim().replace(/^window.NuvioSimpleDefaults=/,'').replace(/;$/,''));
 assert.deepEqual(d.home,JSON.parse(await readFile(new URL('../config/home.template.json',import.meta.url),'utf8')));assert.deepEqual(d.appearance,JSON.parse(await readFile(new URL('../config/tv-appearance.json',import.meta.url),'utf8')));
 const html=await readFile(new URL('../setup.html',import.meta.url),'utf8');assert.ok(html.includes("connect-src 'none'"));assert.ok(html.includes('scripts/preset.js'));assert.ok(!html.includes('type="password"'));
});
