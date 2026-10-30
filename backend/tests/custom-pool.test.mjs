import test from 'node:test';
import assert from 'node:assert/strict';
import {customRoute,closestPreset} from '../../shared/routes.mjs';
test('closed pool and fixed gates are enforced without discarding selections',()=>{
 const catalog=['gate','a','b'].map(id=>({id}));
 assert.equal(customRoute({stopIds:['b'],entryId:'gate',exitId:'gate'},catalog,{}, {gateIds:['gate'],allowedPlaceIds:['gate','a']}).status,'outside_pool');
 assert.equal(customRoute({stopIds:['a'],entryId:'b',exitId:'gate'},catalog,{}, {gateIds:['gate']}).status,'invalid');
 const routes=[{routeId:'R02',entryGateId:'west',stops:[{placeId:'a'}]},{routeId:'R01',entryGateId:'west',stops:[{placeId:'a'}]},{routeId:'R03',entryGateId:'south',stops:[{placeId:'a'},{placeId:'b'}]}];
 const result=closestPreset(['a','b'],routes,'west');assert.equal(result.route.routeId,'R01');assert.deepEqual(result.extra,['b']);assert.equal(closestPreset(['x'],routes,'west'),null);
});
