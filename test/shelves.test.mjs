import test from 'node:test';
import assert from 'node:assert/strict';
import {makeShelvesPreset} from '../scripts/generate-shelves.mjs';
const options={topxAddonId:'com.topx.test1234',profileId:7,addonUrl:'https://your-addon.example/manifest.json'};
test('hosted presets restore every overflow source and convert exactly 709 service feeds',async()=>{
 const p=await makeShelvesPreset(options),all=p.collections.flatMap(c=>c.folders.flatMap(f=>f.sources));
 assert.equal(p.collections.length,19);assert.equal(all.length,3612);assert.ok(!p.collections.some(c=>c.title==='More Browsing'));
 const services=p.collections.find(c=>c.title==='Streaming Services');assert.equal(services.folders.length,22);assert.ok(services.folders.every(f=>f.focusGifEnabled));
 const sources=services.folders.flatMap(f=>f.sources);assert.equal(sources.length,741);assert.equal(sources.filter(s=>s.addonId==='community.nuvio.serviceshelves.us').length,709);assert.equal(sources.filter(s=>s.addonId==='com.topx.test1234').length,18);
 assert.deepEqual(Object.keys(p.profile.parts),['collections']);assert.equal(p.profile.profileId,7);
});
test('optional Home keeps ranking order and hides every standalone hosted catalog',async()=>{
 const p=await makeShelvesPreset({...options,includeHome:true}),home=p.profile.parts.home.items;
 assert.deepEqual(home.filter(r=>r.enabled).slice(0,3).map(r=>r.catalog_id||r.custom_title),['jw.us.topx.movie','jw.us.topx.series','Streaming Services']);
 const hosted=home.filter(r=>r.addon_id==='community.nuvio.serviceshelves.us');assert.equal(hosted.length,709);assert.ok(hosted.every(r=>!r.enabled));
 const ids=new Set(p.collections.map(c=>c.id));assert.ok(home.filter(r=>r.is_collection).every(r=>ids.has(r.collection_id)));assert.ok(!('settings' in p.profile.parts));assert.ok(!('addons' in p.profile.parts));
});
test('generation rejects unencrypted, credential-bearing or malformed manifest URLs',async()=>{
 for(const addonUrl of ['http://example.com/manifest.json','https://user:password@example.com/manifest.json','https://example.com/manifest.json?api_key=example','https://example.com/wrong'])await assert.rejects(makeShelvesPreset({...options,addonUrl}));
});
