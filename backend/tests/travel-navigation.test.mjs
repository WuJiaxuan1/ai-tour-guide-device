import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TravelStore} from '../src/travel/store.mjs';
import {createNavigationService} from '../src/travel/navigation.mjs';
test('navigation rejects reordered fixes, expires position and ETA, preserves visits, and never persists a trail in receipts',async()=>{
 let now=Date.parse('2026-10-31T10:00:00Z');const store=new TravelStore(':memory:',{clock:()=>now});
 try{
 const s=store.authenticate(store.createSession().token),trip=store.createTrip(s,{client_event_id:'trip'},()=>({status:'active',route:{route_id:'r',revision:1,exit_id:'west',geometry:{coordinates:[[118,32],[118.001,32]]},stops:[{stop_id:'s1',attraction_id:'a1',location:[118,32],status:'pending',planned_stay_seconds:60},{stop_id:'s2',attraction_id:'a2',location:[118.001,32],status:'pending',planned_stay_seconds:120}],legs:[{fromStopId:'s1',toStopId:'s2',walkingSeconds:90}]},visits:[]}));
 let triggers=0;const nav=createNavigationService({store,convertLocation:async p=>p,walkingLeg:async()=>({distance_m:12,walk_seconds:20}),onProximity:()=>triggers++});
 const fix=seq=>({client_seq:seq,captured_at:new Date(now).toISOString(),coordinate_system:'WGS84',location:[118,32],accuracy_m:10});
 let out=await nav.update(s,trip.id,fix(1));assert.equal(out.estimate.remaining_total_seconds,290);assert.equal(triggers,0);
 now+=11000;out=await nav.update(s,trip.id,fix(2));assert.equal(triggers,1);assert.equal(out.current_place.basis,'proximity_candidate');assert.equal(store.getTrip(s,trip.id).visits.length,0);
 await assert.rejects(nav.update(s,trip.id,fix(1)),{code:'STALE_LOCATION'});
 const device=store.authenticate(store.createSession({ownerId:s.owner_id,tripId:trip.id,kind:'device'}).token);
 assert.equal(nav.context(device,trip.id).next_stop.stop_id,'s1');await assert.rejects(nav.update(device,trip.id,fix(3)),{code:'FORBIDDEN'});
 now+=91000;out=nav.context(s,trip.id);assert.equal(out.location.freshness,'stale');assert.equal(out.estimate.to_next_walk_seconds,null);assert.equal(out.current_place.basis,'unknown');
 assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM locations').get().n,1);
 assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM receipts').get().n,1);
 // Inspect persisted event payloads, not random UUIDs which can contain "118".
 const events=store.events(s,trip.id);assert.equal(events.length,3);
 for(const event of events)assert.deepEqual(Object.keys(event.payload),event.type==='location_updated'?['captured_at']:['route_id']);
 }finally{store.close();}
});
test('map outage leaves ETA unknown while a valid fix is kept',async()=>{
 const store=new TravelStore(':memory:');try{
 const s=store.authenticate(store.createSession().token),trip=store.createTrip(s,{client_event_id:'trip'},()=>({status:'active',route:{stops:[{stop_id:'s',location:[118,32],status:'pending'}],legs:[]},visits:[]}));
 const nav=createNavigationService({store,convertLocation:async p=>p,walkingLeg:async()=>{throw Error('offline');}});
 const out=await nav.update(s,trip.id,{client_seq:1,captured_at:new Date().toISOString(),coordinate_system:'WGS84',location:[118,32],accuracy_m:10});assert.equal(out.location.freshness,'fresh');assert.equal(out.estimate.to_next_walk_seconds,null);
 }finally{store.close();}
});
