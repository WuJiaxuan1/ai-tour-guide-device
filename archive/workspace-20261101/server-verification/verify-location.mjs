import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.VERIFY_BASE||'http://127.0.0.1:18788';
const request=async(path,{method='GET',body,token}={})=>{const r=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.ok(r.ok,`${method} ${path}: ${r.status} ${data.error?.code||''}`);return data;};
const {token}=await request('/sessions',{method:'POST'});
let trip;
try {
 trip=await request('/trips',{method:'POST',token,body:{client_event_id:crypto.randomUUID(),preferences:{entrance_id:'west',exit_id:'west',duration:'half_day',intensity:'easy',has_elderly:false,has_children:false},route_id:'R02',revision:1}});
 trip=await request(`/trips/${trip.id}/commands`,{method:'POST',token,body:{client_event_id:crypto.randomUUID(),expected_version:trip.version,action:'start'}});
 const fix=async(seq,accuracy,age=0)=>request(`/trips/${trip.id}/location`,{method:'POST',token,body:{client_seq:seq,captured_at:new Date(Date.now()-age).toISOString(),coordinate_system:'WGS84',location:[118.79,32.06],accuracy_m:accuracy}});
 const ask=()=>request('/chat',{method:'POST',token,body:{client_event_id:crypto.randomUUID(),conversation_id:'location-acceptance',trip_id:trip.id,question:'我现在在哪'}});
 let context=await fix(1,10,95000);assert.equal(context.location.address.formatted_address,undefined);assert.match((await ask()).reply,/过期/);
 const n=await fix(2,10);assert.equal(n.location.address.status,'resolved');assert.equal(n.location.address.provider,'amap');assert.ok(n.location.address.formatted_address.length>3);assert.equal(n.current_place.basis,'unknown');
 assert.ok((await ask()).reply.includes(n.location.address.formatted_address));
 context=await fix(3,100);assert.equal(context.location.address.formatted_address,undefined);assert.match((await ask()).reply,/精度不足/);
 assert.equal((await request(`/trips/${trip.id}`,{token})).visits.length,0);
 assert.ok((await (await fetch(base+'/')).text()).includes('index-DqTMm0_W.js'));
 const result={at:new Date().toISOString(),base,checks:['real_amap_address_outside_route','grounded_location_answer','inaccurate_location_suppressed','stale_location_suppressed','no_false_visits','new_frontend_bundle','synthetic_trip_cleaned'],user_device_binding_untouched:true};
 // Cleanup below must pass before writing the acceptance receipt.
 trip=await request(`/trips/${trip.id}`,{token});trip=await request(`/trips/${trip.id}/commands`,{method:'POST',token,body:{client_event_id:crypto.randomUUID(),expected_version:trip.version,action:'complete'}});
 assert.equal((await request(`/trips/${trip.id}`,{method:'DELETE',token,body:{expected_version:trip.version}})).deleted,true);trip=null;
 writeFileSync('.local-work/location-acceptance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{
 if(trip){let t=await request(`/trips/${trip.id}`,{token});if(['active','paused'].includes(t.status))t=await request(`/trips/${t.id}/commands`,{method:'POST',token,body:{client_event_id:crypto.randomUUID(),expected_version:t.version,action:'complete'}});await request(`/trips/${t.id}`,{method:'DELETE',token,body:{expected_version:t.version}});}
}
