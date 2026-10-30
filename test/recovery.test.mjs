import test from 'node:test';
import assert from 'node:assert/strict';
import recovery from '../scripts/recovery.cjs';
const fixture=()=>({format:'kaptain-profile-backup',formatVersion:1,profileId:1,parts:{collections:[{id:'c1',folders:[{id:'f1',sources:[{id:'s1',provider:'tmdb'},{id:'s2',provider:'addon',addonId:'example.chart'}]}]}],addons:[{name:'Example',url:'https://example.invalid/realdebrid=REDACTED/manifest.json'}],keys:{tmdb:'test-value'},home:{items:[{collection_id:'c1',enabled:true}]},settings:{desktop:{version:4,features:{theme_settings:{dark:true},tmdb_settings:{tmdb_api_key:'not-a-real-key'},debrid_settings:{enabled:true},player_settings:{auto:true},custom_poster_url_pattern:'https://example.invalid/private-configuration/manifest.json'}}},watched:[{id:'private-history'}]}});
const opts={profileId:2,confirmed:true};
test('layout cannot install redacted addon URLs or credentials, even with all options enabled',()=>{
 const out=recovery.build(fixture(),{...opts,includeHome:true,includeAppearance:true});
 assert.equal(out.summary.redactedAddonCount,1);assert.deepEqual(Object.keys(out.profile.parts),['collections','home','settings']);
 assert.deepEqual(Object.keys(out.profile.parts.settings.desktop.features),['theme_settings']);
 for(const x of ['REDACTED','not-a-real-key','private-history','realdebrid','player_settings','tmdb_settings','debrid_settings','test-value'])assert.ok(!JSON.stringify(out.profile).includes(x));
});
test('default restores only collections and preserves source and folder IDs',()=>{
 const b=fixture(),before=JSON.stringify(b);const out=recovery.build(b,opts);
 assert.deepEqual(Object.keys(out.profile.parts),['collections']);assert.deepEqual(out.profile.parts.collections,b.parts.collections);assert.equal(JSON.stringify(b),before);
});
test('requires explicit target and acknowledgement; rejects unsupported structures',()=>{
 for(const n of [0,7,1.5,NaN,undefined])assert.throws(()=>recovery.build(fixture(),{...opts,profileId:n}));
 assert.throws(()=>recovery.build(fixture(),{profileId:2}));assert.throws(()=>recovery.inspect({parts:{collections:[]}}));
 const b=fixture();b.parts.collections[0].folders[0].sources=null;assert.throws(()=>recovery.build(b,opts));
});
test('fails closed on credential-like or placeholder content embedded in layout',()=>{
 for(const value of ['https://example.invalid/?api_key=not-real','https://example.invalid/realdebrid=REDACTED/manifest.json']){
  const b=fixture();b.parts.collections[0].folders[0].coverImageUrl=value;assert.throws(()=>recovery.build(b,opts));
 }
});
test('appearance excludes unknown groups and only permits supported public poster patterns',()=>{
 const b=fixture();b.parts.settings.desktop.features.custom_poster_url_pattern='https://btttr.cc/poster-q/imdb/poster-default/{imdb_id}.jpg?rs=IM';
 assert.equal(recovery.build(b,{...opts,includeAppearance:true}).profile.parts.settings.desktop.features.custom_poster_url_pattern,b.parts.settings.desktop.features.custom_poster_url_pattern);
});
test('detects enabled localhost and native connection requirements without exposing URLs',()=>{
 const b=fixture();b.parts.addons.push({url:'http://127.0.0.1:8789/manifest.json',enabled:true});
 const report=recovery.inspect(b);assert.equal(report.enabledLocalhost,true);assert.equal(report.requiresTmdb,true);assert.deepEqual(report.addonIds,['example.chart']);assert.ok(!JSON.stringify(report).includes('127.0.0.1'));
});
test('Home is opt-in and missing Home cannot silently produce an incomplete restore',()=>{
 const b=fixture();delete b.parts.home;assert.throws(()=>recovery.build(b,{...opts,includeHome:true}));assert.doesNotThrow(()=>recovery.build(b,opts));
});
