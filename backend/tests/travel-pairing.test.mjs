import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TravelStore} from '../src/travel/store.mjs';
import {createPairing} from '../src/travel/pairing.mjs';
test('physical-device pairing needs bridge authorization and one-time code; expiry and owner reassignment are enforced',()=>{
 let now=Date.now();const store=new TravelStore(':memory:',{clock:()=>now}),pairing=createPairing({store,secret:()=> 'private-bridge-secret'});try{
 assert.throws(()=>pairing.authorize('bad'),{code:'UNAUTHORIZED'});pairing.authorize('private-bridge-secret');assert.throws(()=>pairing.session(),{code:'DEVICE_UNBOUND'});
 const s=store.authenticate(store.createSession().token),t=store.createTrip(s,{client_event_id:'t'},()=>({route:{route_id:'R02'}})),code=pairing.issue().pairing_code;
 assert.throws(()=>pairing.bind(s,t.id,{code:'00000000'}),{code:'PAIRING_INVALID'});pairing.bind(s,t.id,{code});assert.equal(pairing.session().trip_id,t.id);assert.throws(()=>pairing.bind(s,t.id,{code}),{code:'PAIRING_INVALID'});
 const other=store.authenticate(store.createSession().token);assert.throws(()=>store.getTrip(pairing.session(),store.createTrip(other,{client_event_id:'other'},()=>({route:{route_id:'R01'}})).id),{code:'NOT_FOUND'});
 const expired=pairing.issue().pairing_code;now+=301000;assert.throws(()=>pairing.bind(s,t.id,{code:expired}),{code:'PAIRING_INVALID'});now+=12*3600000;assert.throws(()=>pairing.session(),{code:'DEVICE_UNBOUND'});
 }finally{store.close();}
});
