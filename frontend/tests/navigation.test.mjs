import test from 'node:test';
import assert from 'node:assert/strict';
import {planWalkingRoute, loadNavigationPlaces, validateRoute} from '../src/services/navigation.js';

// Synthetic coordinates for contract tests only; never used in the visitor app.
const route = () => ({schemaVersion: '1.0', routeId: 'test-only-route', revision: 1,
  travelMode: 'walking', coordinateSystem: 'GCJ02', coordinateOrder: 'lng,lat',
  source: {provider: 'amap', generatedAt: '2026-10-29T08:00:00Z'},
  stops: [{id: 'temple', location: [118.96, 32.15]}, {id: 'pagoda', location: [118.961, 32.151]}],
  geometry: {type: 'LineString', coordinates: [[118.96, 32.15], [118.9605, 32.1503], [118.961, 32.151]]},
  distanceMeters: 180, walkingSeconds: 135,
  steps: [{instruction: 'test instruction', location: [118.96, 32.15], distanceMeters: 180, walkingSeconds: 135}],
});
const ids = ['temple', 'pagoda'];

test('route request sends IDs in selected order, never fabricates POI coordinates', async () => {
  let sent;
  const result = await planWalkingRoute({stopIds: ids, endpoint: '/api/navigation/routes', fetcher: async (url, init) => {
    sent = {url, ...init};return Response.json({route: route()});
  }});
  assert.equal(sent.url, '/api/navigation/routes');
  assert.deepEqual(JSON.parse(sent.body), {schemaVersion: '1.0', travelMode: 'walking', stopIds: ids,
    coordinateSystem: 'GCJ02', coordinateOrder: 'lng,lat'});
  assert.equal(result.geometry.coordinates.length, 3);
});

test('wrong datum, swapped longitude/latitude, wrong stop order and invented missing geometry are rejected', () => {
  for (const change of [
    r => {r.coordinateSystem = 'WGS84';},
    r => {r.geometry.coordinates[0] = [32.15, 118.96];},
    r => {r.stops.reverse();},
    r => {delete r.geometry;},
    r => {r.distanceMeters = -1;},
    r => {r.steps[0].location = [NaN, 32.15];},
    r => {r.stops[0] = null;},
    r => {r.steps[0] = null;},
  ]) {const r = route();change(r);assert.throws(() => validateRoute(r, ids), /路线数据/);}
});

test('unconfigured, failing and malformed services never fall back to straight-line navigation', async () => {
  await assert.rejects(() => planWalkingRoute({stopIds: ids, endpoint: ''}), /尚未连接/);
  await assert.rejects(() => planWalkingRoute({stopIds: ['temple'], endpoint: '/route'}), /至少两个/);
  await assert.rejects(() => planWalkingRoute({stopIds: ids, endpoint: '/route', fetcher: async () => new Response('', {status: 503})}), /503/);
  await assert.rejects(() => planWalkingRoute({stopIds: ids, endpoint: '/route', fetcher: async () => new Response('<html>wrong service</html>')}), /暂不可用/);
});

test('location catalog rejects WGS84 and invalid coordinates before drawing on AMap', async () => {
  assert.deepEqual(await loadNavigationPlaces({endpoint: ''}), []);
  await assert.rejects(() => loadNavigationPlaces({endpoint: '/places', fetcher: async () => Response.json({
    coordinateSystem: 'WGS84', coordinateOrder: 'lng,lat', places: route().stops,
  })}), /位置格式/);
});


test('optimized road order keeps every requested stop and the fixed start',async()=>{
 const requested=['temple','third','pagoda'];const result=route();result.stops=[result.stops[0],result.stops[1],{id:'third',location:[118.962,32.152]}];result.optimization={mode:'shortest',returnToStart:true};let sent;
 const planned=await planWalkingRoute({stopIds:requested,optimize:true,returnToStart:true,fetcher:async(u,init)=>{sent=JSON.parse(init.body);return Response.json({route:result});}});
 assert.equal(sent.optimize,true);assert.equal(sent.returnToStart,true);assert.deepEqual(planned.stops.map(p=>p.id),['temple','pagoda','third']);
 const bad=structuredClone(result);bad.stops[2]=bad.stops[1];assert.throws(()=>validateRoute(bad,requested,{optimize:true}),/路线数据/);
 const moved=structuredClone(result);moved.stops.reverse();assert.throws(()=>validateRoute(moved,requested,{optimize:true}),/路线数据/);
});
