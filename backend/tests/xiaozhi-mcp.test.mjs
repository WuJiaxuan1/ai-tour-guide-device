import test from 'node:test';
import assert from 'node:assert/strict';
import {tools,createToolDispatcher,responseBytes} from '../integrations/xiaozhi/mcp-tools.mjs';

test('xiaozhi tool schemas are read-only and have clear names',()=>{
  assert.deepEqual(tools.map(t=>t.name),[
    'qixia.explain_current_place','qixia.search_knowledge','qixia.recommend_routes','qixia.get_route_catalog','qixia.get_facilities_nearby'
  ]);
  assert.ok(tools.every(t=>t.name.startsWith('qixia.')));
  assert.ok(tools.every(t=>t.description.length>20));
  assert.equal(tools.some(t=>JSON.stringify(t).includes('write')),false);
});

test('tool dispatcher sends bounded requests to the project API',async()=>{
  const calls=[];
  const original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    calls.push({url:String(url),options});
    if(String(url).includes('/api/knowledge/pois/'))return new Response(JSON.stringify({id:'mirror-lake',name:'明镜湖',narration:'湖边讲解'}),{status:200,headers:{'Content-Type':'application/json'}});
    if(String(url).includes('/api/knowledge/chat'))return new Response(JSON.stringify({reply:'有来源的回答',placeIds:['mirror-lake'],knowledgeVersion:'qixia-kb-mvp-v1'}),{status:200,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify({status:'unverified',routes:[]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const dispatch=createToolDispatcher({apiBase:'http://127.0.0.1:8787'});
    const place=await dispatch('qixia.explain_current_place',{placeId:'mirror-lake'});
    assert.equal(place.place.id,'mirror-lake');
    const answer=await dispatch('qixia.search_knowledge',{query:'讲讲明镜湖'});
    assert.equal(answer.reply,'有来源的回答');
    assert.equal(calls.length,2);
    assert.equal(calls[1].options.method,'POST');
    assert.equal(calls[1].options.body.includes('讲讲明镜湖'),true);
  }finally{globalThis.fetch=original;}
});

test('route tool maps supported entry gate and reports unsupported filters',async()=>{
  const original=globalThis.fetch;
  let request;
  globalThis.fetch=async(url,options)=>{
    request={url:String(url),body:JSON.parse(options.body)};
    return new Response(JSON.stringify({status:'matched',routes:[{routeId:'R02',revision:1,name:'西门古刹人文游',navigationReady:false,stops:[{stopId:'r02-1'}]}]}),{status:200});
  };
  try{
    const result=await createToolDispatcher({apiBase:'http://127.0.0.1:8787'})('qixia.recommend_routes',{entryGate:'west',exitGate:'south',preferredPlaceIds:['mirror-lake'],duration:'half'});
    assert.deepEqual(request.body,{gate:'west',duration:'half'});
    assert.deepEqual(result.appliedFilters,{gate:'west',duration:'half'});
    assert.deepEqual(result.unsupportedFilters,['exitGate','preferredPlaceIds']);
  }finally{globalThis.fetch=original;}
});

test('nested place and facility results are compacted within the text budget',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(url)=>{
    if(String(url).includes('/pois/'))return new Response(JSON.stringify({id:'mirror-lake',name:'明镜湖',narration:'湖边讲解'.repeat(200),explanation:'补充说明'}),{status:200});
    return new Response(JSON.stringify({places:Array.from({length:20},(_,i)=>({id:'f'+i,name:'厕所'+i,location:[118.95,32.15],distanceMeters:i}))}),{status:200});
  };
  try{
    const dispatch=createToolDispatcher({apiBase:'http://127.0.0.1:8787'});
    const place=await dispatch('qixia.explain_current_place',{placeId:'mirror-lake'});
    const facilities=await dispatch('qixia.get_facilities_nearby',{type:'厕所'});
    assert.ok(responseBytes(1,place)<=1024);
    assert.ok(responseBytes(1,facilities)<=1024);
    assert.equal(place.place.id,'mirror-lake');
    assert.equal(facilities.facilities[0].id,'f0');
  }finally{globalThis.fetch=original;}
});
