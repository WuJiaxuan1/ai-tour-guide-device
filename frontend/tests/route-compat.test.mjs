import {test} from 'node:test';
import assert from 'node:assert/strict';
import {legacyRoute,isServerTourActive,selectedStays} from '../src/services/route-compat.mjs';
test('restored map keeps repeated gate occurrences and server stop IDs',()=>{
 const route={route_id:'R02',navigation_ready:true,geometry:{type:'LineString',coordinates:[[1,2],[3,4]]},stops:[{stop_id:'in',attraction_id:'gate',planned_stay_seconds:0},{stop_id:'out',attraction_id:'gate',planned_stay_seconds:600}]};
 const adapted=legacyRoute(route);assert.deepEqual(adapted.stops.map(s=>s.stopId),['in','out']);assert.deepEqual(adapted.stops.map(s=>s.placeId),['gate','gate']);assert.equal(adapted.geometry,route.geometry);assert.equal(adapted.stops[1].stayMinutes,10);assert.equal(route.stops[0].stopId,undefined);
 assert.deepEqual(selectedStays(adapted,{gate:0,temple:30}),{gate:0});
});
test('paused server trips remain locked against editing; planned/completed trips do not',()=>{
 for(const status of ['active','paused'])assert.equal(isServerTourActive({status}),true);
 for(const status of ['planned','completed',undefined])assert.equal(isServerTourActive({status}),false);
});
