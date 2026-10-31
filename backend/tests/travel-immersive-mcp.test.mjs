import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {TravelStore} from '../src/travel/store.mjs';
import {createImmersiveService} from '../src/travel/immersive.mjs';
import {createTripTools} from '../integrations/xiaozhi/trip-tools.mjs';
import {navigationContext} from '../src/travel/navigation.mjs';
import {createTravelConversation} from '../src/travel/conversations.mjs';

test('query-time hint survives web dismissal, covers device location/next-stop variants and stops on stale/finished experiences',async()=>{
 const store=new TravelStore(':memory:');try{
  const session=store.authenticate(store.createSession().token),now=Date.now();
  const seed={status:'active',route:{stops:[{stop_id:'s',attraction_id:'temple',name:'栖霞寺',status:'pending'}],legs:[]},visits:[],reminders:[{experience_id:'temple-ming-life',status:'dismissed_on_web'}],immersive_sessions:[]};
  const trip=store.createTrip(session,{client_event_id:'hint-trip'},()=>seed),device=store.authenticate(store.createSession({ownerId:session.owner_id,tripId:trip.id,kind:'device'}).token);
  const sample={location:[118,32],accuracy_m:10,captured_at:new Date(now).toISOString(),received_at:new Date(now).toISOString(),nearby_candidate:{attraction_id:'temple',name:'栖霞寺'},route_distance_m:0};
  let nav=navigationContext(trip,sample,now);
  assert.equal(nav.reminders.length,0);assert.match(nav.guidance.next_stop,/沉浸式体验/);assert.match(nav.guidance.location,/沉浸式体验/);
  const answer=createTravelConversation({store,navigation:{context:()=>nav},model:{configured:()=>false},converse:()=>assert.fail('navigation must not invoke model')});
  let i=0;for(const question of ['下一站是哪里','接下来去哪里','下一个景点是哪','我现在在哪里','我们在哪','这里是哪','现在到哪了','到下一站还有多久']){
   const result=await answer(device,{client_event_id:'q'+i++,conversation_id:'voice',question});assert.equal((result.reply.match(/有沉浸式体验/g)||[]).length,1,question);
  }
  for(const changed of [null,{...sample,captured_at:new Date(now-91000).toISOString()},{...sample,accuracy_m:100},{...sample,nearby_candidate:{attraction_id:'mirror-lake'}}])assert.equal(navigationContext(trip,changed,now).immersive_hint,null);
  for(const status of ['paused','completed','planned'])assert.equal(navigationContext({...trip,status},sample,now).immersive_hint,null);
  nav=navigationContext({...trip,immersive_sessions:[{experience_id:'temple-ming-life',completed_at:new Date(now).toISOString()}]},sample,now);
  assert.equal(nav.immersive_hint,null);assert.doesNotMatch((await answer(device,{client_event_id:'done',conversation_id:'voice',question:'下一站去哪'})).reply,/沉浸式体验/);
 }finally{store.close();}
});
test('temple-only reminder deduplicates per trip; full experience validates choices and records completion',()=>{
 const store=new TravelStore(':memory:');try{
 const session=store.authenticate(store.createSession().token),trip=store.createTrip(session,{client_event_id:'create'},()=>({status:'active',route:{route_id:'R',stops:[{stop_id:'s1',attraction_id:'temple'},{stop_id:'s2',attraction_id:'temple'}]},visits:[],reminders:[],immersive_sessions:[]}));
 const service=createImmersiveService({root:fileURLToPath(new URL('../..',import.meta.url)),store}),place={stop_id:'s1',attraction_id:'temple',name:'栖霞寺'};
 assert.equal(service.list().length,1);assert.equal(service.list()[0].attraction_id,'temple');assert.throws(()=>service.get('palace-first-person'),{code:'NOT_FOUND'});
 service.onProximity(session,trip.id,{stop_id:'p',attraction_id:'palace',name:'行宫'});assert.equal(store.getTrip(session,trip.id).reminders.length,0);
 service.onProximity(session,trip.id,place);service.onProximity(session,trip.id,{...place,stop_id:'s2'});let state=store.getTrip(session,trip.id);assert.equal(state.reminders.length,1);assert.equal(state.reminders[0].voice_delivery,'not_connected');
 const command=extra=>service.command(session,trip.id,{client_event_id:'cmd-'+state.version,expected_version:state.version,experience_id:'temple-ming-life',...extra});
 state=command({});assert.equal(state.reminders[0].status,'opened_on_web');assert.throws(()=>command({choice_id:'see-today'}),{code:'INVALID_CHOICE'});
 for(const choice_id of ['departure-letter','home-books','wish-friend','give-home','see-today'])state=command({choice_id});
 assert.ok(state.immersive_sessions[0].completed_at);assert.equal(state.immersive_sessions[0].choices.length,5);assert.equal(state.immersive_sessions[0].choices[1].label,'安置书卷');assert.equal(state.visits.length,0);
 state=command({action:'restart'});assert.equal(state.immersive_sessions[0].current_scene,'departure');assert.equal(state.immersive_sessions[0].previous_runs.length,1);
 const device=store.authenticate(store.createSession({ownerId:session.owner_id,tripId:trip.id,kind:'device'}).token);assert.throws(()=>service.command(device,trip.id,{}),{code:'FORBIDDEN'});
 }finally{store.close();}
});

test('dismissal persists across repeated proximity; route membership and manual opening prevent unwanted prompts',()=>{
 const store=new TravelStore(':memory:');try{
 const session=store.authenticate(store.createSession().token),service=createImmersiveService({root:fileURLToPath(new URL('../..',import.meta.url)),store});
 const create=(key,stops)=>store.createTrip(session,{client_event_id:key},()=>({status:'active',route:{stops},reminders:[],immersive_sessions:[]}));
 const place={stop_id:'t',attraction_id:'temple',name:'栖霞寺'};
 let t=create('trip',[place]);service.onProximity(session,t.id,place);t=store.getTrip(session,t.id);
 t=service.dismiss(session,t.id,{client_event_id:'dismiss',expected_version:t.version,reminder_id:t.reminders[0].id});service.onProximity(session,t.id,place);
 assert.equal(store.getTrip(session,t.id).reminders[0].status,'dismissed_on_web');assert.equal(store.getTrip(session,t.id).reminders.length,1);
 const other=create('other',[]);service.onProximity(session,other.id,place);assert.equal(store.getTrip(session,other.id).reminders.length,0);
 let manual=create('manual',[place]);service.command(session,manual.id,{client_event_id:'open',expected_version:manual.version,experience_id:'temple-ming-life'});service.onProximity(session,manual.id,place);assert.equal(store.getTrip(session,manual.id).reminders.length,0);
 }finally{store.close();}
});

test('MCP tools cannot take an arbitrary trip/owner/token and never invent a successful command',async()=>{
 const calls=[],tripId='12345678-1234-1234-1234-123456789abc';const tools=createTripTools({baseUrl:'http://127.0.0.1:8787',token:'test-secret',tripId,fetcher:async(url,options)=>{calls.push({url:String(url),options});return new Response(JSON.stringify({reply:'下一站行宫'}),{status:200});}});
 assert.equal((await tools.call('qixia_trip_ask',{question:'下一站哪里'})).reply,'下一站行宫');assert.equal(JSON.parse(calls[0].options.body).trip_id,tripId);assert.equal(calls[0].options.headers.Authorization,'Bearer test-secret');assert.equal(calls[0].url.includes('test-secret'),false);await assert.rejects(tools.call('qixia_trip_ask',{question:'q',trip_id:'other'}),/参数无效/);await assert.rejects(tools.call('qixia_trip_confirm_visit',{}),/缺少/);assert.throws(()=>createTripTools({baseUrl:'http://remote.example.test',token:'test',tripId}),/HTTPS/);
});
