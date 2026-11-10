import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TravelStore} from '../src/travel/store.mjs';
import {createNavigationService,navigationContext} from '../src/travel/navigation.mjs';
import {createTripService} from '../src/travel/trips.mjs';
import {createTravelConversation} from '../src/travel/conversations.mjs';
import {navigationIntent,navigationReply} from '../src/travel/navigation-replies.mjs';

function fixture(){
 let now=Date.parse('2026-10-31T08:00:00Z'),seq=0;
 const store=new TravelStore(':memory:',{clock:()=>now}),s=store.authenticate(store.createSession().token);
 const route={navigation_ready:true,geometry:{coordinates:[[118,32],[118.002,32]]},stops:['西门','明镜湖','栖霞寺'].map((name,i)=>({stop_id:'s'+i,name,location:[118+i*.001,32],status:'pending',planned_stay_seconds:60})),legs:[{fromStopId:'s0',toStopId:'s1',walkingSeconds:120,distanceMeters:100},{fromStopId:'s1',toStopId:'s2',walkingSeconds:180,distanceMeters:150}]};
 const t=store.createTrip(s,{client_event_id:'create'},()=>({status:'planned',paused_ms:0,route,visits:[]}));
 const service=createTripService(store,{}),nav=createNavigationService({store,convertLocation:async p=>p,walkingLeg:async()=>({distance_m:50,walk_seconds:60})});
 const command=(action,stop_id)=>service.command(s,t.id,{client_event_id:'c'+(++seq),expected_version:store.getTrip(s,t.id).version,action,stop_id});
 const fix=(point=[118,32],accuracy=10)=>nav.update(s,t.id,{client_seq:++seq,captured_at:new Date(now).toISOString(),coordinate_system:'WGS84',location:point,accuracy_m:accuracy});
 return {store,s,t,nav,command,fix,advance:ms=>{now+=ms;}};
}

test('compound next-stop question returns distance/time, total includes stays and Beijing finish time',async()=>{
 const f=fixture();try{
  f.command('start');await f.fix();const n=f.nav.context(f.s,f.t.id);
  assert.equal(n.estimate.remaining_distance_m,300);assert.equal(n.estimate.remaining_total_seconds,540);
  assert.equal(navigationIntent('到下一站还有多远，要多久'),'next_leg');assert.match(n.guidance.next_leg,/50米、1分钟/);
  assert.match(n.guidance.remaining,/9分钟.*步行6分钟.*计划停留3分钟/);assert.match(n.guidance.finish_time,/北京时间.*16:09/);
  const answer=createTravelConversation({store:f.store,navigation:f.nav,model:{configured:()=>false},converse:()=>assert.fail('navigation must not use model/knowledge')});
  const reply=await answer(f.s,{client_event_id:'a1',trip_id:f.t.id,conversation_id:'web',question:'下一站还有多远'});assert.equal(reply.reply,n.guidance.next_leg);
  assert.match((await answer(f.s,{client_event_id:'a2',trip_id:f.t.id,conversation_id:'web',question:'到明镜湖要多久'})).reply,/没有计算到明镜湖/);
  assert.equal(navigationIntent('给我讲讲明镜湖'),null);assert.equal(navigationIntent('明镜湖适合玩多久'),null);
 }finally{f.store.close();}
});

test('planned, paused, resume awaiting new fix and completed never issue live navigation estimates',async()=>{
 const f=fixture();try{
  assert.match(f.nav.context(f.s,f.t.id).guidance.next_stop,/尚未开始/);
  f.command('start');await f.fix();f.advance(1000);f.command('pause');let n=f.nav.context(f.s,f.t.id);
  assert.equal(n.estimate.to_next_distance_m,null);assert.match(n.guidance.next_stop,/已暂停.*西门/);assert.equal(n.off_route.status,'unknown');
  f.advance(1000);f.command('resume');n=f.nav.context(f.s,f.t.id);assert.equal(n.location.freshness,'awaiting_update');assert.match(n.guidance.next_leg,/等待新的手机定位/);
  await f.fix();assert.equal(f.nav.context(f.s,f.t.id).estimate.to_next_distance_m,50);
  f.command('complete');n=f.nav.context(f.s,f.t.id);assert.equal(n.next_stop,null);assert.equal(n.estimate.remaining_total_seconds,null);assert.match(n.guidance.next_stop,/行程已结束/);assert.match(n.guidance.location,/行程已结束/);
 }finally{f.store.close();}
});

test('next-stop transition invalidates old leg; skipped gaps suppress total but allow next leg',async()=>{
 const f=fixture();try{
  f.command('start');await f.fix();f.command('confirm_visit','s0');let n=f.nav.context(f.s,f.t.id);assert.equal(n.next_stop.name,'明镜湖');assert.equal(n.estimate.to_next_walk_seconds,null);
  f.advance(10000);await f.fix();f.command('skip_stop','s2');n=f.nav.context(f.s,f.t.id);assert.equal(n.estimate.to_next_walk_seconds,60);assert.equal(n.estimate.remaining_total_seconds,null);assert.match(n.guidance.remaining,/跳过/);
  f.command('confirm_visit','s1');n=f.nav.context(f.s,f.t.id);assert.equal(n.next_stop,null);assert.match(n.guidance.next_leg,/没有待完成/);assert.equal(n.progress.skipped_stop_count,1);assert.equal(n.progress.confirmed_stop_count,2);
 }finally{f.store.close();}
});

test('phone clock behind server is accepted after start/resume, but a fix crossing resume is rejected',async()=>{
 const f=fixture();try{
  f.command('start');let seq=100;
  const input=()=>({client_seq:seq++,captured_at:new Date(Date.parse(f.nav.context(f.s,f.t.id).server_time)-5000).toISOString(),coordinate_system:'WGS84',location:[118,32],accuracy_m:10});
  let n=await f.nav.update(f.s,f.t.id,input());assert.equal(n.location.freshness,'fresh');
  f.advance(10000);f.command('pause');f.advance(1000);f.command('resume');assert.equal(f.nav.context(f.s,f.t.id).location.freshness,'awaiting_update');
  n=await f.nav.update(f.s,f.t.id,input());assert.equal(n.location.freshness,'fresh');
  let entered,unblock;const started=new Promise(resolve=>entered=resolve),blocked=new Promise(resolve=>unblock=resolve);
  const nav=createNavigationService({store:f.store,convertLocation:async p=>{entered();await blocked;return p;}});
  f.advance(10000);const waiting=nav.update(f.s,f.t.id,input());await started;
  f.command('pause');f.advance(1000);f.command('resume');unblock();await assert.rejects(waiting,{code:'STALE_LOCATION'});
 }finally{f.store.close();}
});

test('off-route requires consecutive accurate fixes for 20 seconds; gaps, stale and missing geometry are unknown',async()=>{
 const f=fixture();try{
  f.command('start');let n=await f.fix([118.01,32]);assert.equal(n.off_route.status,'checking');
  // Existing releases saved a count without a starting timestamp; restart that streak.
  const legacy=f.store.location(f.s,f.t.id);delete legacy.off_route_since;
  f.store.db.prepare('UPDATE locations SET body=? WHERE trip_id=?').run(JSON.stringify(legacy),f.t.id);
  f.advance(10000);n=await f.fix([118.01,32]);assert.equal(n.off_route.status,'checking');
  f.advance(10000);n=await f.fix([118.01,32]);assert.equal(n.off_route.status,'checking');
  f.advance(10000);n=await f.fix([118.01,32]);assert.equal(n.off_route.status,'suspected');assert.match(n.guidance.off_route,/直线.*不是步行距离/);
  f.advance(31000);n=await f.fix([118.01,32]);assert.equal(n.off_route.status,'checking');
  f.advance(10000);n=await f.fix([118,32]);assert.equal(n.off_route.status,'not_detected');
  f.advance(10000);n=await f.fix([118.01,32],100);assert.equal(n.off_route.status,'unknown');assert.match(n.guidance.off_route,/精度不足/);
  f.advance(91000);assert.equal(f.nav.context(f.s,f.t.id).off_route.status,'unknown');
  const t=f.store.getTrip(f.s,f.t.id),sample={...f.store.location(f.s,f.t.id),accuracy_m:10,captured_at:new Date().toISOString(),route_distance_m:null};
  n=navigationContext(t,sample);assert.equal(n.off_route.status,'unknown');assert.match(navigationReply(n,'off_route'),/缺少.*几何/);
 }finally{f.store.close();}
});
