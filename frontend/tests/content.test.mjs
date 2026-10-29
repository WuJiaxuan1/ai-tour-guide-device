import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {places} from '../src/data.js';
const publicRoot=new URL('../public/',import.meta.url);
test('all selected catalog entries have readable content and a real generated wave narration',()=>{
  assert.equal(places.length,38);assert.equal(new Set(places.map(p=>p.id)).size,38);
  for(const p of places){assert.ok(p.story.length>30);assert.equal(/主办方|静态导览|演示/.test(p.story),false);const wave=readFileSync(new URL(p.audio.slice(1),publicRoot));assert.equal(wave.subarray(0,4).toString(),'RIFF');assert.ok(wave.length>32000);}
});
test('all 41 unique supplied photographs are used, while religious cards stay last and temple is third',()=>{
  const sources=JSON.parse(readFileSync(new URL('assets/photo-sources.json',publicRoot),'utf8'));
  const used=new Set(places.flatMap(p=>p.images));for(const original of Object.keys(sources))assert.ok(used.has(original),`Organizer photo retained: ${original}`);
  for(const u of used)assert.ok(existsSync(new URL(u.slice(1),publicRoot)));
  assert.equal(places[2].id,'temple');let religious=false;for(const p of places){if(p.religious)religious=true;if(religious)assert.equal(p.religious,true);}
});


test('facility records and imported scenic POIs stay in Qixia and use no more than five AMap photos',()=>{
 const facilities=JSON.parse(readFileSync(new URL('../src/content/facilities.json',import.meta.url),'utf8'));
 const nodes=JSON.parse(readFileSync(new URL('../../backend/data/navigation-nodes.json',import.meta.url),'utf8')).nodes;
 for(const p of [...places,...facilities]){
  assert.ok(p.images.filter(u=>u.startsWith('/assets/amap/')).length<=5);
  for(const u of p.images)assert.ok(existsSync(new URL(u.slice(1),publicRoot)));
  if(p.navigationAvailable){const n=nodes[p.id];assert.ok(n);assert.ok(n.location[0]>=118.950&&n.location[0]<=118.990&&n.location[1]>=32.145&&n.location[1]<=32.180);}
 }
 assert.equal(facilities.some(p=>/内部专用|小区/.test(p.name+' '+p.address)),false);
 assert.ok(existsSync(new URL('assets/qixia-illustration.png',publicRoot)));
});
