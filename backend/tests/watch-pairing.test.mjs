import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {TravelStore} from '../src/travel/store.mjs';
import {createPairing} from '../src/travel/pairing.mjs';
import {createTravelApi} from '../src/travel/api.mjs';
import {definitions} from '../integrations/xiaozhi/bridge-tools.mjs';
const makeTrip=(store,owner,key='trip')=>store.createTrip(owner,{client_event_id:key},()=>({status:'planned',route:{stops:[]}}));
test('one watch code binds voice and map, secrets are hashed, code is single-use and issuing another does not steal binding',()=>{
 const store=new TravelStore(':memory:');try{
  const p=createPairing({store,secret:()=>''}),owner=store.authenticate(store.createSession().token),trip=makeTrip(store,owner),claim=p.beginWatch();
  assert.equal(p.watchStatus(claim.claim_token).bound,false);assert.throws(()=>p.watchSession(claim.claim_token),{code:'DEVICE_UNBOUND'});
  assert.throws(()=>p.bind(owner,trip.id,{code:'00000000'}),{code:'PAIRING_INVALID'});
  assert.equal(p.bind(owner,trip.id,{code:claim.pairing_code}).watch_linked,true);
  assert.equal(p.session().trip_id,p.watchSession(claim.claim_token).trip_id);assert.equal(p.status(owner,trip.id).watch_linked,true);
  assert.throws(()=>p.bind(owner,trip.id,{code:claim.pairing_code}),{code:'PAIRING_INVALID'});
  p.beginWatch();assert.equal(p.watchSession(claim.claim_token).trip_id,trip.id);
  const rows=JSON.stringify(store.db.prepare('SELECT * FROM watch_pairings').all());assert.ok(!rows.includes(claim.claim_token));assert.ok(!rows.includes(claim.pairing_code));
  assert.throws(()=>p.watchStatus('x'.repeat(43)),{code:'UNAUTHORIZED'});
  assert.ok(!definitions.some(d=>d.name==='qixia_pairing_code'));
 }finally{store.close();}
});
test('expired code, expired binding, reassignment and deleted trip deny access; service recreation preserves valid pairing',()=>{
 let now=Date.now();const store=new TravelStore(':memory:',{clock:()=>now});try{
  let p=createPairing({store,secret:()=>''});const owner=store.authenticate(store.createSession().token),trip=makeTrip(store,owner),old=p.beginWatch();
  now+=301000;assert.throws(()=>p.bind(owner,trip.id,{code:old.pairing_code}),{code:'PAIRING_INVALID'});
  const a=p.beginWatch();p.bind(owner,trip.id,{code:a.pairing_code});p=createPairing({store,secret:()=>''});assert.equal(p.watchStatus(a.claim_token).trip_id,trip.id);
  const foreign=store.authenticate(store.createSession().token),other=makeTrip(store,foreign),b=p.beginWatch();p.bind(foreign,other.id,{code:b.pairing_code});
  assert.throws(()=>p.watchSession(a.claim_token),{code:'UNAUTHORIZED'});assert.equal(p.status(owner,trip.id).bound,false);
  now+=12*3600000+1;assert.throws(()=>p.watchStatus(b.claim_token),{code:'UNAUTHORIZED'});
  const c=p.beginWatch();p.bind(owner,trip.id,{code:c.pairing_code});store.db.prepare('DELETE FROM trips WHERE id=?').run(trip.id);assert.throws(()=>p.watchStatus(c.claim_token),{code:'NOT_FOUND'});
 }finally{store.close();}
});
test('HTTP pairing restores web state and restricts watch claims to their own navigation endpoints',async t=>{
 const store=new TravelStore(':memory:'),root=fileURLToPath(new URL('../..',import.meta.url));
 const api=createTravelApi({root,store,presets:{routes:[]},model:{configured:()=>false}});
 const server=http.createServer((req,res)=>api.handle(req,res,new URL(req.url,'http://localhost')));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await api.close();});
 const base=`http://127.0.0.1:${server.address().port}/api/v1`;
 const req=async(path,token,body)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 const web=store.createSession().token,owner=store.authenticate(web),trip=makeTrip(store,owner),other=makeTrip(store,owner,'other');
 const claim=(await req('/watch/pairings',null,{})).data;
 assert.equal((await req('/watch/pairing',claim.claim_token)).data.bound,false);
 assert.equal((await req(`/trips/${trip.id}/watch/navigation`,claim.claim_token)).status,409);
 assert.equal((await req(`/trips/${trip.id}/pair-device`,web,{code:claim.pairing_code})).data.watch_linked,true);
 assert.equal((await req(`/trips/${trip.id}/pair-device`,web)).data.bound,true);
 assert.equal((await req('/watch/pairing',claim.claim_token)).data.trip_id,trip.id);
 assert.equal((await req(`/trips/${trip.id}/watch/navigation`,claim.claim_token)).data.status,'planned');
 assert.equal((await req(`/trips/${other.id}/watch/navigation`,claim.claim_token)).status,404);
 for(const path of [`/trips/${trip.id}`,`/trips/${trip.id}/pair-device`,'/trips','/capabilities'])assert.equal((await req(path,claim.claim_token)).status,401);
 assert.equal((await req('/bridge/tools',claim.claim_token,{name:'qixia_trip_context',arguments:{}})).status,401);
 const next=(await req('/watch/pairings',null,{})).data;await req(`/trips/${other.id}/pair-device`,web,{code:next.pairing_code});
 assert.equal((await req(`/trips/${trip.id}/watch/navigation`,claim.claim_token)).status,401);
});
