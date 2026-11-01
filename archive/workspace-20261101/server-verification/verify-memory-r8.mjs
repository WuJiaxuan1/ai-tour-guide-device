import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.VERIFY_BASE||'http://127.0.0.1:18788';
const request=async(path,{method='GET',body,token}={})=>{const response=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(50000)});const value=await response.json();assert.ok(response.ok,`${path}: ${response.status} ${value.error?.code||''}`);return value;};
const {token}=await request('/sessions',{method:'POST'});let trip,deviceToken,job;
const get=()=>request(`/trips/${trip.id}`,{token});
const command=async(action,stop_id)=>{trip=await get();trip=await request(`/trips/${trip.id}/commands`,{method:'POST',token,body:{client_event_id:crypto.randomUUID(),expected_version:trip.version,action,...(stop_id?{stop_id}:{})}});};
const note=(text,credential=token)=>request(`/trips/${trip.id}/notes`,{method:'POST',token:credential,body:{client_event_id:crypto.randomUUID(),text}});
const ask=(question,credential=token)=>request('/chat',{method:'POST',token:credential,body:{client_event_id:crypto.randomUUID(),conversation_id:'memory-acceptance',trip_id:trip.id,question}});
try{
 const preferences={entrance_id:'west',exit_id:'west',duration:'half_day',intensity:'easy',has_elderly:false,has_children:false};
 trip=await request('/trips',{method:'POST',token,body:{client_event_id:crypto.randomUUID(),preferences,route_id:'R02',revision:1}});await command('start');
 // A separate scoped test credential never touches the physical device's pairing.
 deviceToken=(await request(`/trips/${trip.id}/device-binding`,{method:'POST',token,body:{}})).token;
 const lake=trip.route.stops.find(s=>s.attraction_id==='mirror-lake');assert.ok(lake);
 await command('confirm_visit',lake.stop_id);
 const gate=trip.route.stops.find(s=>s.attraction_id==='west-gate');if(gate)await command('confirm_visit',gate.stop_id);
 await ask('下一站是哪里');await ask('我现在在哪里',deviceToken);
 await note('我最喜欢明镜湖，湖边很安静。',deviceToken);await note('我不喜欢拥挤的地方。');
 for(const choice_id of [null,'departure-letter','home-books','wish-friend','give-home','see-today']){
  trip=await get();trip=await request(`/trips/${trip.id}/immersive`,{method:'POST',token,body:{client_event_id:crypto.randomUUID(),expected_version:trip.version,experience_id:'temple-ming-life',...(choice_id?{choice_id}:{})}});
 }
 await command('pause');await new Promise(r=>setTimeout(r,1200));await command('resume');await command('complete');
 let memory=await request(`/trips/${trip.id}/memory`,{token});
 assert.equal(memory.facts.confirmed_attraction_count,1);assert.deepEqual(memory.facts.confirmed_attraction_names,[lake.name]);
 assert.ok(memory.facts.paused_seconds>=1);assert.equal(memory.facts.elapsed_seconds,memory.facts.active_seconds+memory.facts.paused_seconds);
 assert.deepEqual(memory.facts.interaction_channels,{web:1,device:1});assert.deepEqual(memory.facts.note_channels,{web:1,device:1});
 assert.equal(memory.facts.interests.length,1);assert.match(memory.facts.interests[0].text,/最喜欢明镜湖/);
 assert.equal(memory.facts.immersive_experiences[0].completed,true);assert.equal(memory.facts.immersive_experiences[0].choices.length,5);
 const input={client_event_id:crypto.randomUUID(),kind:'memory_summary'};
 job=await request(`/trips/${trip.id}/jobs`,{method:'POST',token,body:input});
 assert.equal((await request(`/trips/${trip.id}/jobs`,{method:'POST',token,body:input})).id,job.id);
 for(let i=0;i<35;i++){job=await request(`/trips/${trip.id}/jobs/${job.id}`,{token});if(['succeeded','failed'].includes(job.status))break;await new Promise(r=>setTimeout(r,2000));}
 assert.equal(job.status,'succeeded',job.error?.message);assert.ok(job.result.summary?.length);assert.match(job.result.summary,/明镜湖/);assert.match(job.result.summary,/喜欢/);
 assert.equal(job.result.facts.confirmed_attraction_count,1);assert.equal(job.result.notes.length,2);assert.ok(job.result.source_fingerprint);
 memory=await request(`/trips/${trip.id}/memory`,{token});assert.equal(memory.jobs.find(j=>j.id===job.id).summary_stale,false);
 await note('结束后补记：今天听见了鸟鸣。',deviceToken);
 memory=await request(`/trips/${trip.id}/memory`,{token});assert.equal(memory.jobs.find(j=>j.id===job.id).summary_stale,true);assert.equal(memory.jobs.find(j=>j.id===job.id).result.notes.length,2);assert.equal(memory.notes.length,3);
 assert.ok((await request('/trips',{token})).trips.some(t=>t.id===trip.id));
 const foreign=(await request('/sessions',{method:'POST'})).token;
 assert.equal((await fetch(base+`/api/v1/trips/${trip.id}/memory`,{headers:{Authorization:'Bearer '+foreign}})).status,404);
 assert.ok((await(await fetch(base+'/')).text()).includes('index-BlpAny5-.js'));
 const summary=job.result.summary;
 trip=await get();assert.equal((await request(`/trips/${trip.id}`,{method:'DELETE',token,body:{expected_version:trip.version}})).deleted,true);trip=null;
 const result={at:new Date().toISOString(),base,checks:['actual_scenic_visit_dedup','pause_duration_invariant','web_device_interaction_counts','explicit_voice_interest_not_negative_note','immersive_choices_without_false_visit','real_model_summary','idempotent_generation','snapshot_facts_and_notes','fresh_summary_marker','late_note_stale_marker','history_reopen','foreign_owner_denied','new_frontend_bundle','synthetic_trip_cleaned'],synthetic_summary:summary,user_pairing_untouched:true};
 writeFileSync('.local-work/memory-acceptance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{
 if(trip){
  if(job&&['queued','running'].includes(job.status))for(let i=0;i<30;i++){job=await request(`/trips/${trip.id}/jobs/${job.id}`,{token});if(['succeeded','failed'].includes(job.status))break;await new Promise(r=>setTimeout(r,2000));}
  trip=await get();if(['active','paused'].includes(trip.status))await command('complete');
  await request(`/trips/${trip.id}`,{method:'DELETE',token,body:{expected_version:trip.version}});
 }
}
