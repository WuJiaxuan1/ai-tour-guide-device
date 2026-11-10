import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const base=process.env.VERIFY_BASE||'http://127.0.0.1:18788',checks=[],answers=[];
const version='qixia-deepseek-v2.1';
const req=async(path,{method='GET',body,token}={})=>{const r=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});const data=await r.json();assert.ok(r.ok,`${method} ${path}: ${r.status} ${data.error?.code||''}`);return data;};
const {token}=await req('/sessions',{method:'POST'});let trip;
const command=async action=>{trip=await req(`/trips/${trip.id}`,{token});trip=await req(`/trips/${trip.id}/commands`,{method:'POST',token,body:{client_event_id:randomUUID(),expected_version:trip.version,action}});};
try{
 const local=readFileSync('frontend/dist/client/index.html','utf8').match(/\/assets\/(index-[^" ]+\.js)/)[1];
 assert.ok((await(await fetch(base+'/')).text()).includes(local));checks.push('current_web_bundle');
 const health=await(await fetch(base+'/api/health')).json();assert.ok(health.ok&&health.mapConfigured&&health.servicesConfigured);checks.push('server_and_map');
 const caps=await req('/capabilities',{token});assert.equal(caps.knowledge.version,version);assert.equal(caps.knowledge.records,213);assert.equal(caps.knowledge.pois,29);assert.equal(caps.knowledge.retrieval,159);assert.equal(caps.text_model_configured,true);assert.equal(caps.photo_craft_available,false);checks.push('knowledge_version_counts_and_existing_capabilities');
 const catalog=await(await fetch(base+'/api/knowledge/catalog')).json();assert.equal(catalog.version,version);assert.equal(catalog.pois.length,29);assert.match(catalog.pois.find(p=>p.id==='pagoda').narration,/石/);checks.push('new_public_poi_content');
 trip=await req('/trips',{method:'POST',token,body:{client_event_id:randomUUID(),preferences:{entrance_id:'west',exit_id:'west',duration:'half_day',intensity:'easy',has_elderly:true,has_children:true},route_id:'R02',revision:1}});await command('start');
 const device=await req(`/trips/${trip.id}/device-binding`,{method:'POST',token,body:{}});checks.push('synthetic_trip_device_without_global_rebinding');
 const ask=async(question,t=token)=>{const begin=Date.now();const result=await req('/chat',{method:'POST',token:t,body:{client_event_id:randomUUID(),conversation_id:'kb-r14-check-'+answers.length,trip_id:trip.id,question}});assert.equal(result.knowledgeVersion,version);answers.push({question,reply:result.reply,mode:result.mode,channel:t===token?'web':'device',seconds:(Date.now()-begin)/1000});console.log(JSON.stringify(answers.at(-1)));return result;};
 const pagoda=await ask('舍利塔是木塔还是石塔？请简短解释。');assert.equal(pagoda.mode,'grounded-model');assert.match(pagoda.reply,/石/);assert.ok(pagoda.sourceIds.includes('knowledge-pack:'+version));checks.push('real_model_web_pagoda');
 const poet=await ask('陆羽是谁，和栖霞山有什么关系？',device.token);assert.equal(poet.mode,'grounded-model');assert.match(poet.reply,/陆羽/);assert.match(poet.reply,/茶/);checks.push('real_model_device_new_person');
 const restroom=await ask('千佛崖卫生间在哪？');assert.equal(restroom.mode,'grounded-model');assert.match(restroom.reply,/卫生间/);assert.match(restroom.reply,/2026|快照|采集/);checks.push('real_model_facility_entity_and_snapshot_date');
 if(!process.env.VERIFY_PUBLIC){const science=await ask('现在给我讲讲红叶为什么会红');assert.equal(science.mode,'grounded-model');checks.push('science_not_dynamic_keyword_fallback');}
 const today=await ask('今天红叶红了吗');assert.equal(today.unknown,true);assert.notEqual(today.mode,'grounded-model');checks.push('no_fabricated_live_maple');
 const nav=await req(`/trips/${trip.id}/navigation-context`,{token});const next=await ask('下一站去哪',device.token);assert.equal(next.mode,'navigation');assert.ok(next.reply.includes(nav.next_stop.name));checks.push('real_navigation_still_authoritative');
 const logs=(await req(`/trips/${trip.id}/interactions`,{token})).interactions;assert.ok(logs.some(m=>m.channel==='web')&&logs.some(m=>m.channel==='device'));checks.push('shared_chat_history');
 const result={at:new Date().toISOString(),base,knowledge_version:version,checks,answers,global_binding_untouched:true};writeFileSync('.local-work/kb-acceptance.json',JSON.stringify(result,null,2));console.log(JSON.stringify({checks,passed:checks.length}));
}finally{if(trip){await command('complete');await req(`/trips/${trip.id}`,{method:'DELETE',token,body:{expected_version:trip.version}});}}
