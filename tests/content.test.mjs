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
  const used=new Set(places.flatMap(p=>p.images));assert.equal(used.size,41);assert.deepEqual([...used].sort(),Object.keys(sources).sort());
  for(const u of used)assert.ok(existsSync(new URL(u.slice(1),publicRoot)));
  assert.equal(places[2].id,'temple');let religious=false;for(const p of places){if(p.religious)religious=true;if(religious)assert.equal(p.religious,true);}
});
