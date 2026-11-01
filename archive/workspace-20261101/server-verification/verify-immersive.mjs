import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.VERIFY_BASE||'http://127.0.0.1:18788';
const request=async(path,{method='GET',body,token}={})=>{const r=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.ok(r.ok,`${method} ${path}: ${r.status} ${data.error?.code||''}`);return data;};
const {token}=await request('/sessions',{method:'POST'});let trip,seq=0;
const get=()=>request(`/trips/${trip.id}`,{token});
const command=async(action)=>{trip=await get();trip=await request(`/trips/${trip.id}/commands`,{method:'POST',token,body:{client_event_id:crypto.randomUUID(),expected_version:trip.version,action}});};
const experience='temple-ming-life';
try{
 const catalog=await request('/experiences',{token});assert.equal(catalog.experiences.length,1);assert.equal(catalog.experiences[0].attraction_id,'temple');
 assert.equal((await fetch(base+'/api/v1/experiences/palace-first-person',{headers:{Authorization:'Bearer '+token}})).status,404);
 const preferences={entrance_id:'west',exit_id:'west',duration:'half_day',intensity:'easy',has_elderly:false,has_children:false};
 const plans=await request('/planner/recommend',{method:'POST',token,body:preferences});for(const r of plans.routes)assert.equal(r.immersive_experiences.length>0,r.stops.some(s=>s.attraction_id==='temple'));
 trip=await request('/trips',{method:'POST',token,body:{client_event_id:crypto.randomUUID(),preferences,route_id:'R02',revision:1}});await command('start');
 const temple=trip.route.stops.find(s=>s.attraction_id==='temple');assert.ok(temple?.location);
 let raw=[...temple.location];
 for(let i=0;i<3;i++){const r=await fetch(base+'/api/location/convert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({coordinateSystem:'WGS84',location:raw})});assert.ok(r.ok);const d=await r.json();raw=raw.map((n,k)=>n+temple.location[k]-d.location[k]);}
 const fix=()=>request(`/trips/${trip.id}/location`,{method:'POST',token,body:{client_seq:++seq,captured_at:new Date().toISOString(),coordinate_system:'WGS84',location:raw,accuracy_m:10}});
 await fix();await new Promise(resolve=>setTimeout(resolve,11000));let n=await fix();assert.equal(n.current_place.attraction_id,'temple');assert.equal(n.reminders.length,1);assert.equal(n.reminders[0].voice_delivery,'not_connected');
 const answer=await request('/chat',{method:'POST',token,body:{client_event_id:crypto.randomUUID(),conversation_id:'immersive-acceptance',trip_id:trip.id,question:'我现在在哪'}});assert.match(answer.reply,/沉浸式体验.*网页/);
 trip=await get();trip=await request(`/trips/${trip.id}/immersive-reminder`,{method:'POST',token,body:{client_event_id:crypto.randomUUID(),expected_version:trip.version,reminder_id:n.reminders[0].id}});
 n=await fix();assert.equal(n.reminders.length,0);trip=await get();assert.equal(trip.reminders.length,1);
 for(const question of ['下一站是哪里','我现在在哪里']){const a=await request('/chat',{method:'POST',token,body:{client_event_id:crypto.randomUUID(),conversation_id:'hint-after-dismiss',trip_id:trip.id,question}});assert.match(a.reply,/沉浸式体验/);}assert.match(n.guidance.next_stop,/沉浸式体验/);
 const act=async(extra={})=>{trip=await get();trip=await request(`/trips/${trip.id}/immersive`,{method:'POST',token,body:{client_event_id:crypto.randomUUID(),expected_version:trip.version,experience_id:experience,...extra}});};
 await act();assert.equal(trip.immersive_sessions[0].current_scene,'departure');
 for(const choice_id of ['departure-letter','home-books','wish-friend','give-home','see-today'])await act({choice_id});
 trip=await get();assert.ok(trip.immersive_sessions[0].completed_at);assert.equal(trip.immersive_sessions[0].choices.length,5);assert.equal(trip.visits.length,0);assert.equal((await request(`/trips/${trip.id}/navigation-context`,{token})).immersive_hint,null);
 const memory=await request(`/trips/${trip.id}/memory`,{token});assert.equal(memory.facts.immersive_experiences[0].completed,true);assert.ok(memory.facts.immersive_experiences[0].choices.includes('安置书卷'));
 const foreign=await request('/sessions',{method:'POST'});assert.equal((await fetch(base+`/api/v1/trips/${trip.id}`,{headers:{Authorization:'Bearer '+foreign.token}})).status,404);
 for(const path of ['index.html','app.js','integration.js','style.css','assets/plain-home.webp','assets/plain-fadu.webp','assets/plain-legacy.webp','assets/qixia-today.webp','assets/audio/bell.wav']){const r=await fetch(base+'/immersive/qixia-temple/'+path);assert.equal(r.status,200);assert.ok((await r.arrayBuffer()).byteLength>100);}
 assert.ok((await (await fetch(base+'/')).text()).includes('index-naDl2GbB.js'));
 const mobile=await fetch(base+'/immersive/qixia-temple/assets/plain-home-mobile-083185d802d1.webp');assert.equal(mobile.status,200);assert.match(mobile.headers.get('cache-control'),/immutable/);assert.ok((await mobile.arrayBuffer()).byteLength<90000);const html=await(await fetch(base+'/immersive/qixia-temple/index.html')).text();assert.ok(!html.includes('href=\"assets/plain-fadu.webp\"'));assert.ok(html.includes('scene-assets.js'));
 await command('complete');assert.equal((await request(`/trips/${trip.id}`,{method:'DELETE',token,body:{expected_version:trip.version}})).deleted,true);trip=null;
 const result={at:new Date().toISOString(),base,checks:['temple_only_catalog','route_tags_match_stops','real_conversion_proximity_reminder','query_time_voice_reminder','dismissal_no_repeat','manual_start','five_saved_choices_and_completion','memory_without_false_visit','foreign_owner_denied','static_team_assets','new_frontend_bundle','synthetic_trip_cleaned','query_hint_after_web_dismiss','no_hint_after_experience_complete','mobile_assets_and_first_scene_priority'],user_device_binding_untouched:true,proactive_voice_connected:false};
 writeFileSync('.local-work/immersive-acceptance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(trip){trip=await get();if(['active','paused'].includes(trip.status))await command('complete');await request(`/trips/${trip.id}`,{method:'DELETE',token,body:{expected_version:trip.version}});}}
