import test from 'node:test';
import assert from 'node:assert/strict';
import {tripReport} from '../src/services/trip-report.mjs';
test('history report uses the selected trip snapshot and retains repeated visits',()=>{
 const trip={created_at:'2026-11-01T01:00:00Z',status:'completed',route:{name:'西门往返',distance_m:1548,estimated_total_seconds:3600,stops:[{stop_id:'a',attraction_id:'gate',name:'西门',status:'visited'},{stop_id:'b',attraction_id:'gate',name:'西门',status:'pending'}]}};
 const before=JSON.stringify(trip),report=tripReport(trip,()=>({name:'旧名称',image:'photo.webp'}));
 assert.equal(report.title,'西门往返');assert.equal(report.plannedMinutes,60);assert.equal(report.distanceMeters,1548);
 assert.deepEqual(report.stops.map(s=>s.reportKey),['a','b']);assert.equal(report.stops[0].name,'西门');assert.equal(report.stops[0].image,'photo.webp');assert.notEqual(report.stops[0].intro,report.stops[1].intro);assert.equal(JSON.stringify(trip),before);
 const other=tripReport({...trip,route:{...trip.route,name:'南门短线',distance_m:null,estimated_total_seconds:null,stops:[{stop_id:'c',attraction_id:'unknown',name:'旧景点'}]}},()=>undefined);
 assert.equal(other.title,'南门短线');assert.equal(other.distanceMeters,null);assert.equal(other.plannedMinutes,null);assert.equal(other.stops[0].name,'旧景点');
});
