import {test} from 'node:test';
import assert from 'node:assert/strict';
import {travelRequest,askTravel,setActiveTripId,subscribeTrip,uploadTravelPhoto} from '../src/services/travel-api.js';
const storage=()=>{const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
test('web travel adapter reuses private session, sends active trip and does not put credentials in URL',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.localStorage;globalThis.localStorage=storage();const calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(url.endsWith('/sessions')?{token:'private-session-token',expires_at:new Date(Date.now()+60000).toISOString()}:{reply:'下一站明镜湖'}),{status:200});};
 try{setActiveTripId('test-trip');await askTravel({question:'下一站',conversationId:'web'});await travelRequest('/capabilities');assert.equal(calls.filter(c=>c.url.endsWith('/sessions')).length,1);const chat=calls.find(c=>c.url.endsWith('/chat'));assert.equal(JSON.parse(chat.options.body).trip_id,'test-trip');assert.equal(chat.options.headers.Authorization,'Bearer private-session-token');assert.equal(calls.some(c=>c.url.includes('private-session-token')),false);await assert.rejects(uploadTravelPhoto('test-trip',{type:'text/plain',size:1}),/PNG/);}finally{globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage;}
});
test('SSE parser accepts split frames, reports actual connection and forwards ordered events',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.localStorage;globalThis.localStorage=storage();localStorage.setItem('qixia.server-session.v1',JSON.stringify({token:'private-token',expires_at:new Date(Date.now()+60000).toISOString()}));
 const encoder=new TextEncoder(),events=[];let opened=false;
 globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/v1/trips/test/events/stream?after=4');assert.equal(options.headers.Authorization,'Bearer private-token');return new Response(new ReadableStream({start(controller){for(const text of [': heartbeat\n\nid: 5\nda','ta: {"server_seq":5}\n\nid: 6\ndata: {"server_seq":6}','\n\n'])controller.enqueue(encoder.encode(text));controller.close();}}));};
 try{await subscribeTrip('test',4,e=>events.push(e.server_seq),new AbortController().signal,()=>{opened=true;});assert.equal(opened,true);assert.deepEqual(events,[5,6]);}finally{globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage;}
});
