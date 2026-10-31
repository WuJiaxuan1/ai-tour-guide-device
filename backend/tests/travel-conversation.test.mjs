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
