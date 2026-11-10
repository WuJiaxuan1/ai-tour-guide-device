import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TravelStore} from '../src/travel/store.mjs';
import {createTravelConversation} from '../src/travel/conversations.mjs';
import {createTextModel} from '../src/travel/text-model.mjs';
test('provider uses the chosen endpoint, Trace-Id and grounded evidence; auth failures never become a fabricated answer',async()=>{
 let called;
 const model=createTextModel({config:()=>({provider:'deepseek',model:'deepseek-flash',apiKey:'test-secret'}),fetcher:async(url,options)=>{called={url,options};return {ok:true,json:async()=>({choices:[{message:{content:'有来源的回答'}}]})};}});
 assert.equal((await model.generate({purpose:'answer',question:'明镜湖',context:{fact:'湖景'}})).text,'有来源的回答');
 assert.equal(called.url,'https://api.deepseek.com/chat/completions');assert.ok(called.options.headers['Trace-Id']);assert.equal(JSON.parse(called.options.body).stream,false);
 const bad=createTextModel({config:()=>({provider:'jdcloud',model:'DeepSeek-V4.1-Flash-1017',apiKey:'test'}),fetcher:async()=>({ok:false,status:401})});
 await assert.rejects(bad.generate({purpose:'answer',question:'q',context:{}}),{code:'MODEL_UNAVAILABLE'});
});
test('web and bound device use the same trip; original questions persist and duplicate calls do not generate twice',async()=>{
 const store=new TravelStore(':memory:');try{
 const s=store.authenticate(store.createSession().token),trip=store.createTrip(s,{client_event_id:'trip'},()=>({status:'active',route:{route_id:'r'}}));
 const d=store.authenticate(store.createSession({ownerId:s.owner_id,tripId:trip.id,kind:'device'}).token);
 let calls=0;const service=createTravelConversation({store,navigation:{context:()=>({next_stop:{name:'明镜湖'},location:{freshness:'stale'},current_place:{}})},knowledge:{publicPoi:id=>id==='mirror-lake'?{id,name:'明镜湖',narration:'湖景'}:null},converse:async()=>({reply:'知识依据',sourceIds:['mirror-lake'],placeIds:['mirror-lake']}),model:{configured:()=>true,generate:async()=>{calls++;return{text:'基于湖景资料的讲解',model:'mock'};}}});
 const next=await service(d,{client_event_id:'d1',conversation_id:'voice',question:'下一站去哪'});assert.match(next.reply,/明镜湖/);assert.equal(calls,0);
 const input={client_event_id:'w1',conversation_id:'web',question:'介绍明镜湖',trip_id:trip.id,place_id:'mirror-lake'};
 await service(s,input);await service(s,input);assert.equal(calls,1);
 const logs=store.chatHistory(s,{tripId:trip.id});assert.equal(logs.length,2);assert.deepEqual(new Set(logs.map(l=>l.channel)),new Set(['device','web']));
 assert.match((await service(d,{client_event_id:'d2',conversation_id:'voice',question:'讲讲这里'})).reply,/不能确认/);
 await assert.rejects(service(d,{client_event_id:'d3',conversation_id:'voice',question:'下一站',trip_id:'foreign'}),{code:'FORBIDDEN'});
 }finally{store.close();}
});

test('full knowledge and application instructions use a stable prefix; summaries never receive the pack',async()=>{
 const bodies=[];const model=createTextModel({config:()=>({provider:'deepseek',model:'deepseek-flash',apiKey:'test'}),fetcher:async(url,options)=>{bodies.push(JSON.parse(options.body));return {ok:true,json:async()=>({choices:[{message:{content:'答复'}}]})};}});
 await model.generate({purpose:'answer',question:'舍利塔',knowledgeInstructions:'应用规则',context:{knowledge:'石构塔参考资料',knowledge_version:'2.1'},history:[{role:'user',content:'你好'}]});
 const a=bodies[0];assert.ok(a.messages[0].content.includes('应用规则'));assert.ok(a.messages[1].content.includes('石构塔参考资料'));assert.equal(a.messages[2].content,'你好');assert.equal(a.messages.filter(m=>m.content.includes('石构塔参考资料')).length,1);assert.equal(a.max_tokens,1200);
 await model.generate({purpose:'summary',question:'总结',context:{facts:{}},knowledgeInstructions:'不应加入'});
 assert.match(bodies[1].messages[0].content,/旅行回忆编辑/);assert.doesNotMatch(bodies[1].messages[0].content,/不应加入/);assert.equal(bodies[1].messages.length,2);
});
test('web and device share v2.1 evidence; science avoids dynamic fallback and live navigation bypasses model',async()=>{
 const store=new TravelStore(':memory:');try{
 const s=store.authenticate(store.createSession().token),trip=store.createTrip(s,{client_event_id:'trip'},()=>({status:'active',route:{route_id:'r'}}));const d=store.authenticate(store.createSession({ownerId:s.owner_id,tripId:trip.id,kind:'device'}).token);
 const received=[];let dynamicCalls=0;
 const knowledge={version:'qixia-deepseek-v2.1',publicPoi:()=>null,modelEvidence:()=>({instructions:'规则',context:'完整新版知识',sourceIds:['knowledge-pack:qixia-deepseek-v2.1'],placeIds:[]}),chat:()=>({reply:'资料',sourceIds:[]})};
 const service=createTravelConversation({store,knowledge,navigation:{context:()=>({status:'active',next_stop:{name:'明镜湖'},location:{freshness:'stale'},current_place:{}})},converse:()=>assert.fail('retired knowledge must not run'),dynamic:{query:()=>{dynamicCalls++;return {items:[]};}},model:{configured:()=>true,generate:async input=>{received.push(input);return {text:'资料支持的科普',model:'test'};}}});
 for(const [session,id]of [[s,'web'],[d,'device']]){const a=await service(session,{client_event_id:id,conversation_id:id,question:'现在给我讲讲红叶为什么红'});assert.equal(a.knowledgeVersion,knowledge.version);assert.equal(a.mode,'grounded-model');}
 assert.equal(dynamicCalls,0);assert.equal(received.length,2);assert.ok(received.every(x=>x.context.knowledge==='完整新版知识'));
 const live=await service(d,{client_event_id:'live',conversation_id:'device',question:'下一站去哪'});assert.match(live.reply,/明镜湖/);assert.equal(received.length,2);
 const today=await service(s,{client_event_id:'today',conversation_id:'web',question:'今天红叶红了吗'});assert.equal(today.unknown,true);assert.equal(dynamicCalls,1);assert.equal(received.length,2);
 }finally{store.close();}
});
