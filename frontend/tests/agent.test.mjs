import test from 'node:test';
import assert from 'node:assert/strict';
import {askAgent,localResponse} from '../src/agent.js';
const request={messages:[{role:'user',content:'介绍舍利塔',mode:'local',placeIds:['pagoda']}],sessionId:'test-session',routeIds:['pagoda'],serviceUrl:'/api/chat'};
test('live adapter sends agreed context, strips UI metadata, and rejects unknown place IDs',async()=>{
 let sent;
 const result=await askAgent({...request,fetcher:async(url,init)=>{sent={url,...init};return Response.json({reply:'真实接口测试回复',placeIds:['pagoda','invented']})}});
 assert.equal(sent.url,'/api/chat');assert.equal(sent.credentials,'omit');
 assert.deepEqual(JSON.parse(sent.body),{sessionId:'test-session',messages:[{role:'user',content:'介绍舍利塔'}],context:{parkId:'qixia-mountain',routeIds:['pagoda']}});
 assert.deepEqual(result,{reply:'真实接口测试回复',placeIds:['pagoda'],mode:'live'});
});
test('live failure never silently falls back to a local content',async()=>{
 await assert.rejects(()=>askAgent({...request,fetcher:async()=>new Response('',{status:503})}),/503/);
 await assert.rejects(()=>askAgent({...request,fetcher:async()=>Response.json({reply:''})}),/格式/);
 await assert.rejects(()=>askAgent({...request,fetcher:async()=>{throw Error('network unavailable')}}),/network unavailable/);
});
test('aborted local response can be cancelled without a fabricated reply',async()=>{
 const c=new AbortController();c.abort();await assert.rejects(()=>askAgent({...request,serviceUrl:'',signal:c.signal}),e=>e.name==='AbortError');
});
test('local content does not invent current operational information',()=>{
 const d=localResponse('今天几点开放，门票多少？');assert.equal(d.mode,'local');assert.deepEqual(d.placeIds,[]);assert.match(d.reply,/不能确认/);
 const p=localResponse('给我讲讲舍利塔的故事');assert.deepEqual(p.placeIds,['pagoda']);
});
