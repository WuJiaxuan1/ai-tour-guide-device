import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TravelStore} from '../src/travel/store.mjs';
import {createNavigationService} from '../src/travel/navigation.mjs';
import {createReverseGeocoder,currentLocationReply} from '../src/travel/location-address.mjs';
import {createTravelConversation} from '../src/travel/conversations.mjs';

test('reverse geocoder uses server key and GCJ02 coordinates; empty provider results are unknown',async()=>{
 let seen;
 const reverse=createReverseGeocoder({key:()=> 'server-only',request:async(...args)=>{seen=args;return {regeocode:{formatted_address:'江苏省南京市栖霞区栖霞大道'}};}});
 assert.equal((await reverse([118.95,32.15])).provider,'amap');
 assert.equal(seen[0],'/v3/geocode/regeo');assert.equal(seen[1].location,'118.950000,32.150000');assert.equal(seen[2],'server-only');assert.equal(seen[1].extensions,'base');
 for(const value of [[],null,'','  ',{},'x'.repeat(301)])assert.equal(await createReverseGeocoder({key:()=> 'k',request:async()=>({regeocode:{formatted_address:value}})})([118,32]),null);
});

function fixture(reverseGeocode){
 let now=Date.parse('2026-10-31T08:00:00Z');const store=new TravelStore(':memory:',{clock:()=>now});
 const session=store.authenticate(store.createSession().token);
 const trip=store.createTrip(session,{client_event_id:'trip'},()=>({status:'active',route:{stops:[{stop_id:'s1',name:'明镜湖',location:[119,32],status:'pending'}],legs:[]},visits:[]}));
 const navigation=createNavigationService({store,convertLocation:async p=>p,reverseGeocode});let seq=0;
 const update=(point=[118,32],accuracy=10)=>navigation.update(session,trip.id,{client_seq:++seq,captured_at:new Date(now).toISOString(),coordinate_system:'WGS84',location:point,accuracy_m:accuracy});
 return {store,session,trip,navigation,update,advance:ms=>{now+=ms;}};
}

test('off-route address is shared with bound device, caches near query origin, refreshes on movement and expires',async()=>{
 let calls=0;const f=fixture(async()=>({formatted_address:`地址${++calls}`,provider:'amap'}));
 try{
  let n=await f.update();assert.equal(n.current_place.basis,'unknown');assert.match(currentLocationReply(n),/地址1/);
  f.advance(11000);n=await f.update([118.0001,32]);assert.equal(calls,1);
  f.advance(11000);n=await f.update([118.001,32]);assert.equal(calls,2);assert.match(currentLocationReply(n),/地址2/);
  f.advance(61000);n=await f.update([118.001,32]);assert.equal(calls,3);
  const device=f.store.authenticate(f.store.createSession({ownerId:f.session.owner_id,tripId:f.trip.id,kind:'device'}).token);
  assert.deepEqual(f.navigation.context(device,f.trip.id).location.address,n.location.address);
  f.advance(91000);n=f.navigation.context(device,f.trip.id);assert.equal(n.location.address.formatted_address,undefined);assert.match(currentLocationReply(n),/过期/);
  assert.equal(f.store.getTrip(f.session,f.trip.id).visits.length,0);
 }finally{f.store.close();}
});

test('inaccurate fixes and provider outages never reuse old addresses or lose the GPS fix',async()=>{
 let fail=false,calls=0;const f=fixture(async()=>{calls++;if(fail)throw Error('provider offline');return {formatted_address:'旧地址',provider:'amap'};});
 try{
  await f.update();f.advance(10000);let n=await f.update([118.002,32],100);assert.equal(calls,1);assert.match(currentLocationReply(n),/精度不足/);assert.equal(n.location.address.formatted_address,undefined);
  fail=true;f.advance(10000);n=await f.update([118.004,32]);assert.equal(n.location.freshness,'fresh');assert.equal(n.location.address.status,'unavailable');assert.doesNotMatch(currentLocationReply(n),/旧地址/);
  const before=calls;f.advance(10000);await f.update([118.004,32]);assert.equal(calls,before);
  f.advance(16000);await f.update([118.004,32]);assert.equal(calls,before+1);
 }finally{f.store.close();}
});

test('location phrases use shared navigation facts without model calls; nearby route candidate retains precedence',async()=>{
 const f=fixture(async()=>({formatted_address:'江苏省南京市某路',provider:'amap'}));
 try{
  await f.update();const device=f.store.authenticate(f.store.createSession({ownerId:f.session.owner_id,tripId:f.trip.id,kind:'device'}).token);
  const answer=createTravelConversation({store:f.store,navigation:f.navigation,model:{configured:()=>true,generate:()=>assert.fail('no model for location')},converse:()=>assert.fail('no knowledge for location')});
  for(const [i,q] of ['我在哪','当前的位置','我的位置','这里是哪里','我在什么地方'].entries())assert.match((await answer(device,{client_event_id:String(i),conversation_id:'voice',question:q})).reply,/江苏省南京市某路/);
  assert.match(currentLocationReply({location:{freshness:'fresh',address:{status:'resolved',formatted_address:'某路'}},current_place:{name:'明镜湖'}}),/接近明镜湖/);
  assert.match(currentLocationReply(null),/开始游览/);
  assert.match(currentLocationReply({location:{freshness:'unavailable'}}),/还没有手机定位/);
 }finally{f.store.close();}
});
