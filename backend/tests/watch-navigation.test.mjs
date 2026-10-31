import test from 'node:test';
import assert from 'node:assert/strict';
import {createWatchNavigation} from '../src/watch/navigation.mjs';
import {crc32,encodeRoute,encodeMap,simplify,advanceProgress} from '../src/watch/wire.mjs';
import {TravelStore} from '../src/travel/store.mjs';
const points=[[118.95,32.15],[118.951,32.15],[118.951,32.151]],bounds={north:32.16,west:118.94,south:32.14,east:118.96};
const render=async()=>({rgb:Buffer.alloc(480*480*3,128),bounds});
test('wire packets match the existing QMAP v4 and QRTE byte layout and checksum',()=>{
 const session='0123456789abcdef0123456789abcdef',route=encodeRoute(points,points.at(-1),session),map=encodeMap(Buffer.alloc(480*480*3,255),bounds,session,route);
 assert.equal(route.toString('ascii',0,4),'QRTE');assert.equal(route.readDoubleLE(64),points.at(-1)[1]);assert.equal(route.readDoubleLE(80),points[0][1]);
 const copy=Buffer.from(route),crc=copy.readUInt32LE(20);copy.writeUInt32LE(0,20);assert.equal(crc32(copy),crc);
 assert.equal(map.length,460896);assert.equal(map[4],4);assert.equal(map.readUInt16LE(96),65535);assert.equal(map.readUInt32LE(84),crc32(route.subarray(64)));assert.equal(map.readUInt32LE(20),crc32(map.subarray(96)));
 assert.deepEqual(simplify([points[0],points[0],...points.slice(1)]),points);
});
test('GPS progress cannot jump ahead, regress or advance from inaccurate/stale fixes',()=>{
 const state={meters:0,cursor:0},path=[[118.95,32.15],[118.96,32.15]],now=Date.now();
 const fix=(lng,time,accuracy_m=8)=>({location:[lng,32.15],accuracy_m,captured_at:new Date(time).toISOString()});
 advanceProgress(state,path,fix(118.9504,now),now);assert.ok(state.cursor>0);const cursor=state.cursor;
 advanceProgress(state,path,fix(118.95,now+1000),now+1000);assert.equal(state.cursor,cursor);
 advanceProgress(state,path,fix(118.959,now+2000),now+2000);assert.equal(state.cursor,cursor);
 advanceProgress(state,path,fix(118.9508,now+3000,80),now+3000);assert.equal(state.cursor,cursor);
 advanceProgress(state,path,fix(118.9508,now+4000),now+30000);assert.equal(state.cursor,cursor);
});
test('watch lifecycle isolates owners, deduplicates work and invalidates old assets on stop/next changes',async()=>{
 let now=Date.now(),renders=0;const store=new TravelStore(':memory:',{clock:()=>now});
 const owner=store.authenticate(store.createSession().token),other=store.authenticate(store.createSession().token);
 const trip=store.createTrip(owner,{client_event_id:'watch-test'},()=>({status:'active',started_at:'start',route:{revision:2,stops:[{stop_id:'a',name:'A',location:points.at(-1),status:'pending'},{stop_id:'b',name:'B',location:points[1],status:'pending'}]},visits:[]}));
 const device=store.authenticate(store.createSession({ownerId:owner.owner_id,tripId:trip.id,kind:'device'}).token);
 const service=createWatchNavigation({store,renderMap:async()=>{renders++;return render();},walkingGeometry:async()=>points});
 try{
  assert.throws(()=>service.manifest(other,trip.id),{code:'NOT_FOUND'});
  assert.equal(service.manifest(device,trip.id).status,'waiting_location');
  const sample={location:points[0],accuracy_m:8,captured_at:new Date(now).toISOString(),received_at:new Date(now).toISOString(),client_seq:1,source_session_id:owner.id};
  store.saveLocation(owner,trip.id,sample);
  assert.equal(service.manifest(device,trip.id).status,'preparing');service.manifest(owner,trip.id);
  await new Promise(setImmediate);
  const ready=service.manifest(device,trip.id);assert.equal(ready.status,'ready');assert.equal(renders,1);assert.equal(ready.position.valid,true);
  assert.equal(service.asset(device,trip.id,ready.session,'map').length,460896);
  assert.throws(()=>service.acknowledge(owner,trip.id,{session:ready.session,frame_id:1,route_revision:1}),{code:'FORBIDDEN'});
  service.acknowledge(device,trip.id,{session:ready.session,frame_id:1,route_revision:1});assert.ok(service.manifest(owner,trip.id).ack);
  now+=16000;assert.equal(service.manifest(device,trip.id).position.valid,false);
  store.mutate(owner,trip.id,{client_event_id:'next'},t=>{t.route.stops[0].status='visited';});
  assert.throws(()=>service.asset(device,trip.id,ready.session,'route'),{code:'WATCH_CHANGED'});assert.equal(service.manifest(device,trip.id).status,'waiting_location');
  store.mutate(owner,trip.id,{client_event_id:'pause'},t=>{t.status='paused';});assert.equal(service.manifest(device,trip.id).status,'paused');
 }finally{store.close();}
});
