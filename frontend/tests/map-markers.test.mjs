import test from 'node:test';
import assert from 'node:assert/strict';
import {routeMapStops,endpointOffset} from '../src/services/map-markers.mjs';

test('map stops keep occurrence identity and only boundary stops get endpoint icons',()=>{
 const mapped=routeMapStops([{stopId:'start',placeId:'gate',location:[118.95,32.15]},{stopId:'visit-1',placeId:'temple',location:[118.96,32.15]},{stopId:'visit-2',placeId:'temple',location:[118.96,32.15]},{stopId:'end',placeId:'gate',location:[118.95,32.15]}]);
 assert.deepEqual(mapped.map(p=>p.endpoint),['start',null,null,'end']);
 assert.deepEqual(mapped.map(p=>p.id),['start','visit-1','visit-2','end']);
 assert.deepEqual(endpointOffset(mapped[0],mapped),[-18,0]);assert.deepEqual(endpointOffset(mapped.at(-1),mapped),[18,0]);
 assert.deepEqual(mapped[0].location,mapped.at(-1).location); // offset icons, never invent geographic separation
});
test('distinct gate icons stay geographically anchored',()=>{
 const mapped=routeMapStops([{id:'west',location:[118.95,32.15]},{id:'south',location:[118.96,32.14]}]);
 assert.deepEqual(endpointOffset(mapped[0],mapped),[0,0]);assert.deepEqual(endpointOffset(mapped[1],mapped),[0,0]);
});
