import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePersonalRoute} from '../src/services/personal-routes.js';
const plan=ids=>({navigationReady:true,travelMode:'walking',coordinateSystem:'GCJ02',coordinateOrder:'lng,lat',source:{provider:'amap',generatedAt:'2026-10-30T00:00:00Z'},distanceMeters:100,walkingSeconds:200,stops:ids.map((id,i)=>({id,placeId:id,stopId:'s'+i,name:id,location:[118.95+i*.001,32.15]})),geometry:{type:'LineString',coordinates:[[118.95,32.15],[118.96,32.15]]},legs:ids.slice(1).map((_,i)=>({fromStopId:'s'+i,toStopId:'s'+(i+1),distanceMeters:10,walkingSeconds:20})),optimization:{mode:'preset'}});
test('personal route validation preserves preset occurrences and fixed endpoint custom optimization',()=>{
 assert.equal(validatePersonalRoute(plan(['g','a','b','a','g']),['g','a','b','a','g'],{fixedOrder:true}).stops.length,5);
 assert.equal(validatePersonalRoute(plan(['g','b','a','z']),['g','a','b','z']).stops[1].id,'b');
 for(const corrupt of [p=>p.coordinateSystem='WGS84',p=>p.stops.pop(),p=>p.stops[1].stopId='s0',p=>p.geometry=null,p=>p.legs[0].fromStopId='bad',p=>p.distanceMeters=-1]){const p=plan(['g','a','g']);corrupt(p);assert.throws(()=>validatePersonalRoute(p,['g','a','g']));}
 assert.throws(()=>validatePersonalRoute(plan(['g','b','a','g']),['g','a','b','g'],{fixedOrder:true}));
});
