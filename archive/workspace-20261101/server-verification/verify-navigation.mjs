import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.VERIFY_BASE||'http://127.0.0.1:18788';
const request=async(path,{method='GET',body,token}={})=>{const r=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.ok(r.ok,`${method} ${path}: ${r.status} ${data.error?.code||''}`);return data;};
const {token}=await request('/sessions',{method:'POST'});let trip,seq=0;
const get=()=>request(`/trips/${trip.id}`,{token});
const context=()=>request(`/trips/${trip.id}/navigation-context`,{token});
const command=async(action,stop_id)=>{trip=await get();trip=await request(`/trips/${trip.id}/commands`,{method:'POST',token,body:{client_event_id:crypto.randomUUID(),expected_version:trip.version,action,...(stop_id?{stop_id}:{})}});};
const ask=question=>request('/chat',{method:'POST',token,body:{client_event_id:crypto.randomUUID(),conversation_id:'navigation-acceptance',trip_id:trip.id,question}});
const fix=point=>request(`/trips/${trip.id}/location`,{method:'POST',token,body:{client_seq:++seq,captured_at:new Date().toISOString(),coordinate_system:'WGS84',location:point,accuracy_m:20}});
try {
 trip=await request('/trips',{method:'POST',token,body:{client_event_id:crypto.randomUUID(),preferences:{entrance_id:'west',exit_id:'west',duration:'half_day',intensity:'easy',has_elderly:false,has_children:false},route_id:'R02',revision:1}});
 assert.match((await ask('下一站去哪')).reply,/尚未开始/);
 await command('start');let n=await fix([118.96,32.15]);assert.ok(n.estimate.to_next_walk_seconds>0);assert.ok(n.estimate.remaining_total_seconds>0);
 assert.equal((await ask('到下一站还有多远，要多久')).reply,n.guidance.next_leg);
 assert.equal((await ask('全程还有多久')).reply,n.guidance.remaining);assert.match((await ask('几点能出山')).reply,/北京时间/);
 await command('skip_stop',trip.route.stops[1].stop_id);n=await context();assert.equal(n.estimate.remaining_total_seconds,null);assert.match((await ask('全程还有多久')).reply,/跳过/);
 await command('pause');assert.match((await ask('下一站去哪')).reply,/暂停/);assert.match((await ask('下一站要多久')).reply,/暂停/);assert.equal((await context()).off_route.status,'unknown');
 await command('resume');n=await context();assert.equal(n.location.freshness,'awaiting_update');assert.equal(n.estimate.to_next_walk_seconds,null);
 n=await fix([118.96,32.15]);assert.ok(n.estimate.to_next_walk_seconds>0);
 // All remaining stops are skipped only on this disposable trip, so off-route sampling has no road requests.
 for(const stop of trip.route.stops.filter(s=>s.status==='pending'))await command('skip_stop',stop.stop_id);
 n=await fix([118.79,32.06]);assert.equal(n.off_route.status,'checking');
 for(let i=0;i<2;i++){await new Promise(resolve=>setTimeout(resolve,10050));n=await fix([118.79,32.06]);}
 assert.equal(n.off_route.status,'suspected');assert.match((await ask('我走偏了吗')).reply,/可能偏离.*直线/);
 await command('complete');n=await context();assert.equal(n.next_stop,null);assert.match((await ask('下一站去哪')).reply,/行程已结束/);assert.match((await ask('还有多久')).reply,/行程已结束/);
 assert.ok((await (await fetch(base+'/')).text()).includes('index-DDS1SK4k.js'));
 assert.equal((await request(`/trips/${trip.id}`,{method:'DELETE',token,body:{expected_version:trip.version}})).deleted,true);trip=null;
 const result={at:new Date().toISOString(),base,checks:['planned_status','real_walking_next_leg','total_and_finish_time','skip_gap_unknown','paused_status','resume_needs_new_fix','off_route_consecutive_fixes','completed_no_next_stop','new_frontend_bundle','synthetic_trip_cleaned'],user_device_binding_untouched:true};
 writeFileSync('.local-work/navigation-acceptance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{
 if(trip){trip=await get();if(['active','paused'].includes(trip.status))await command('complete');await request(`/trips/${trip.id}`,{method:'DELETE',token,body:{expected_version:trip.version}});}
}
