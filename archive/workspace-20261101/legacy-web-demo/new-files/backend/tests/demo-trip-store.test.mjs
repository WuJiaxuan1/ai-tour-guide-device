import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createDemoTripStore} from '../src/demo-trip.mjs';

const root=resolve(import.meta.dirname,'../..');
const known=new Map([
  ['mirror-lake',{id:'mirror-lake',name:'彩虹明镜',navigationAvailable:true,tags:[]}],
  ['pagoda',{id:'pagoda',name:'舍利塔',navigationAvailable:true,tags:[]}],
  ['gate',{id:'gate',name:'栖霞山西门',navigationAvailable:true,tags:['出入口']}],
  ['toilet',{id:'toilet',name:'公共厕所',navigationAvailable:true,kind:'facility',tags:[]}],
]);
const token='a'.repeat(64),other='b'.repeat(64);
const snapshot=(ids=['mirror-lake','pagoda'])=>({selectedPlaces:ids.map(id=>({id})),entryId:'gate',exitId:'gate',
  stayMinutes:{'mirror-lake':20},focusedPlaceId:null,recentQuestions:['想看看湖景']});
function fixture(t){mkdirSync(resolve(root,'.local-work'),{recursive:true});const dir=mkdtempSync(resolve(root,'.local-work/demo-store-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));let time=1000;
  return {dir,store:createDemoTripStore(dir,known,{file:'trip.json',now:()=>time,ttlMs:500}),advance:ms=>time+=ms};}
test('demo persists canonical names, input and order through reload; end erases visitor content',t=>{
  const f=fixture(t),input=snapshot();input.selectedPlaces[0].name='Forged';
  const trip=f.store.start(token,input);assert.equal(trip.selectedPlaces[0].name,'彩虹明镜');
  assert.equal(f.store.session(token).revision,1);assert.equal(trip.locationAvailable,false);
  assert.equal(f.store.start(token,input).id,trip.id);
  const after=f.store.update(token,snapshot(['pagoda','mirror-lake']),1);assert.equal(after.revision,2);
  assert.deepEqual(after.selectedPlaces.map(p=>p.id),['pagoda','mirror-lake']);
  const reloaded=createDemoTripStore(f.dir,known,{file:'trip.json',now:()=>1000});
  assert.equal(reloaded.current().id,trip.id);assert.equal(reloaded.current().revision,2);
  f.store.end(token);assert.equal(reloaded.current().active,false);
  const raw=readFileSync(resolve(f.dir,'trip.json'),'utf8');assert.doesNotMatch(raw,/pagoda|想看看|tokenHash/);
});
test('another browser cannot replace or modify active demo; stale revisions cannot overwrite',t=>{
  const f=fixture(t);f.store.start(token,snapshot());
  assert.throws(()=>f.store.start(other,snapshot()),{status:409});
  assert.throws(()=>f.store.session(other),{status:401});assert.throws(()=>f.store.end(other),{status:401});
  f.store.update(token,snapshot(['pagoda']),1);
  assert.throws(()=>f.store.update(token,snapshot(),1),{status:409});
  assert.deepEqual(f.store.current().selectedPlaces.map(p=>p.id),['pagoda']);
});
test('fixed two-hour lifetime is not extended by synchronization; expiry erases content',t=>{
  const f=fixture(t);f.store.start(token,snapshot());f.advance(400);
  assert.equal(f.store.update(token,snapshot(['pagoda']),1).expiresAt,1500);
  f.advance(101);assert.equal(f.store.current().active,false);
  assert.throws(()=>f.store.session(token),{status:404});
  assert.equal(f.store.start(other,snapshot()).active,true);
});
test('empty selection, facilities and more than twelve destinations remain valid',t=>{
  const f=fixture(t);f.store.start(token,snapshot([]));
  assert.equal(f.store.update(token,snapshot(['toilet']),1).selectedPlaces[0].kind,'facility');
  const many=new Map(Array.from({length:20},(_,i)=>['p'+i,{id:'p'+i,name:'P'+i,navigationAvailable:true}]));
  const store=createDemoTripStore(f.dir,many,{file:'many.json',now:()=>1000});
  assert.equal(store.start(token,{selectedPlaces:[...many.keys()].map(id=>({id}))}).selectedPlaces.length,20);
});
test('invalid IDs, duplicates, gates, durations and oversized input are rejected',t=>{
  const {store}=fixture(t);
  for(const ids of [['missing'],['gate'],['pagoda','pagoda']])assert.throws(()=>store.start(token,snapshot(ids)),{status:400});
  assert.throws(()=>store.start('short',snapshot()),{status:401});
  assert.throws(()=>store.start(token,{...snapshot(),stayMinutes:{'mirror-lake':361}}),{status:400});
  assert.throws(()=>store.start(token,{...snapshot(),recentQuestions:['x'.repeat(2001)]}),{status:400});
});
test('identical sync is a no-op and corrupted persistence fails closed',t=>{
  const f=fixture(t);f.store.start(token,snapshot());assert.equal(f.store.update(token,snapshot(),1).revision,1);
  assert.doesNotMatch(readFileSync(resolve(f.dir,'trip.json'),'utf8'),new RegExp(token));
  writeFileSync(resolve(f.dir,'trip.json'),'broken');assert.throws(()=>f.store.current(),{status:503});
});
