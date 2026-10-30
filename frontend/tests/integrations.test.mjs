import test from 'node:test';
import assert from 'node:assert/strict';
import {syncRoute} from '../src/services/integrations.js';
const route={routeId:'route-a',revision:1,geometry:{type:'LineString',coordinates:[[118.96,32.15],[118.97,32.16]]}};
test('watch adapter distinguishes queue receipt and refuses stale acknowledgements',async()=>{
 const d=await syncRoute({endpoint:'/api/devices/routes',deviceId:'watch',route,fetcher:async()=>Response.json({routeId:'route-a',revision:1,status:'queued'})});assert.equal(d.status,'queued');
 await assert.rejects(()=>syncRoute({endpoint:'/api/devices/routes',deviceId:'watch',route,fetcher:async()=>Response.json({routeId:'old',revision:1,status:'received'})}),/回执/);
 await assert.rejects(()=>syncRoute({endpoint:'https://other.example/api',deviceId:'watch',route}),/同源/);
});
