import test from 'node:test';
import assert from 'node:assert/strict';
import {fixedEndpointOrder,createRoadPlanner} from '../src/road-planner.mjs';
const permutations=a=>a.length?a.flatMap((v,i)=>permutations(a.filter((_,j)=>j!==i)).map(t=>[v,...t])):[[]];
test('fixed entrance and exit shortest ordering agrees with exhaustive directed permutations',()=>{
 for(let n=1;n<=6;n++){
  const m=Array.from({length:n+2},(_,i)=>Array.from({length:n+2},(_,j)=>i===j?0:((i+3)*(j+7)*13)%91+1));
  const cost=o=>o.slice(1).reduce((s,v,i)=>s+m[o[i]][v],0);
  const expected=Math.min(...permutations(Array.from({length:n},(_,i)=>i+1)).map(p=>cost([0,...p,n+1])));
  const actual=fixedEndpointOrder(m);assert.equal(actual[0],0);assert.equal(actual.at(-1),n+1);assert.equal(cost(actual),expected);
 }
 assert.throws(()=>fixedEndpointOrder([[0,Infinity,Infinity],[Infinity,0,Infinity],[Infinity,Infinity,0]]),{status:422});
});
const catalog=['g','a','b','z'].map((id,i)=>({id,name:id,location:[118.95+i*.001,32.15]}));
const data={nodes:[],gateIds:['g','z'],routes:[{routeId:'R',name:'fixed',stops:['g','b','a','b','g'].map((id,i)=>({...catalog.find(p=>p.id===id),placeId:id,stopId:'s'+i})),completeness:'complete'}]};
const walk=async(a,b)=>({distance:String(a.id===b.id?0:100),duration:'80',steps:a.id===b.id?[]:[{distance:'100',duration:'80',polyline:a.location.join(',')+';'+b.location.join(','),instruction:'沿步道'}]});
test('presets preserve repeated visits and custom routes accept places outside preset pool',async()=>{
 const plan=createRoadPlanner({catalog,data,walkingLeg:walk});
 const fixed=await plan({presetId:'R'});assert.deepEqual(fixed.stops.map(s=>s.id),['g','b','a','b','g']);assert.equal(fixed.legs.length,4);assert.equal(new Set(fixed.stops.map(s=>s.stopId)).size,5);
 const custom=await plan({entryId:'g',exitId:'z',stopIds:['a','b']});assert.equal(custom.stops.at(-1).id,'z');assert.equal(custom.navigationReady,true);assert.equal(custom.optimization.mode,'exact');assert.equal(custom.legs[0].fromStopId,custom.stops[0].stopId);
 await assert.rejects(plan({entryId:'g',exitId:'z',stopIds:['unknown']}),{status:400});
});
test('unmapped preset nodes and missing exits fail without removing any stop',async()=>{
 const missing={...data,routes:[{routeId:'R',stops:[{placeId:'missing'}]}],nodes:[{id:'missing',name:'待确认地点',location:null}]};
 await assert.rejects(createRoadPlanner({catalog,data:missing,walkingLeg:walk})({presetId:'R'}),/准确位置/);
 missing.routes[0].completeness='missing_exit';await assert.rejects(createRoadPlanner({catalog,data:missing,walkingLeg:walk})({presetId:'R'}),/出口/);
});
test('provider failure and cancellation never produce a drawable route',async()=>{
 await assert.rejects(createRoadPlanner({catalog,data,walkingLeg:async()=>null})({entryId:'g',exitId:'z',stopIds:['a']}),{status:422});
 const c=new AbortController();c.abort();await assert.rejects(createRoadPlanner({catalog,data,walkingLeg:walk})({presetId:'R'},{signal:c.signal}));
});
