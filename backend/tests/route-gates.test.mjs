import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createPresetService} from '../src/presets.mjs';
import {createRoadPlanner} from '../src/road-planner.mjs';
import {routeWithGates,hasRouteLocation} from '../../shared/route-gates.mjs';
import {TravelStore} from '../src/travel/store.mjs';
import {createPersonalTripService} from '../src/travel/personal-trip.mjs';

const root=fileURLToPath(new URL('../..',import.meta.url));
const catalog=['places','facilities'].flatMap(f=>JSON.parse(readFileSync(new URL(`../../frontend/src/content/${f}.json`,import.meta.url),'utf8')));
const {data,match}=createPresetService(root,catalog);
const west=data.gates.find(g=>g.id==='west'),south=data.gates.find(g=>g.id==='south');
const walk=async(a,b)=>({distance:'100',duration:'80',steps:[{distance:'100',duration:'80',polyline:a.location.join(',')+';'+b.location.join(','),instruction:'测试步道'}]});
const plan=createRoadPlanner({catalog,data,walkingLeg:walk});

test('runtime presets exclude unknown coordinates, keep raw source evidence, and have real gate anchors',()=>{
 assert.ok(data.routes.every(r=>r.stops.every(s=>hasRouteLocation(s.location))));
 assert.deepEqual([...new Set(data.routes.flatMap(r=>r.removedStops.map(s=>s.name)))].sort(),['九龙坡','有凌云观景平台','桃花扇亭','青锋涧'].sort());
 assert.equal(west.poiId,'B001913YX0');assert.equal(south.poiId,'B0G0M1MPTG');
 for(const r of data.routes){assert.equal(r.stops[0].placeId,data.gates.find(g=>g.id===r.entryGateId).placeId);assert.equal(r.revision,2);}
 const raw=JSON.parse(readFileSync(new URL('../data/routes/preset-routes.v1.json',import.meta.url),'utf8'));
 assert.ok(raw.routes.find(r=>r.routeId==='R01').stops.some(s=>s.name==='桃花扇亭'));
});

test('selected exit changes recommendations, invalidates old roads, and preserves repeated visits',()=>{
 const result=match({gate:'west',exitGate:'south',duration:'half',intensity:'easy',companions:'none'});
 assert.ok(result.routes.length);
 for(const r of result.routes){assert.equal(r.stops[0].placeId,west.placeId);assert.equal(r.stops.at(-1).placeId,south.placeId);assert.equal(r.roadPlan,undefined);assert.equal(r.geometry,null);}
 const r=result.routes.find(r=>r.routeId==='R02');assert.equal(r.stops.filter(s=>s.placeId==='mirror-lake').length,2);
 const unended=data.routes.find(r=>r.routeId==='R06');
 const ended=routeWithGates(unended,data.gates,south.placeId,west.placeId);
 assert.equal(ended.stops.at(-2).placeId,'taixu');assert.equal(ended.stops.at(-1).placeId,'gate');
 assert.equal(new Set(ended.stops.map(s=>s.stopId)).size,ended.stops.length);
});

test('road planner fixes both user gates for presets, custom routes and the incomplete template',async()=>{
 for(const selection of [{presetId:'R02',entryId:west.placeId,exitId:south.placeId},{stopIds:['temple',west.placeId,south.placeId],entryId:south.placeId,exitId:west.placeId},{presetId:'R06',entryId:south.placeId,exitId:west.placeId}]){
  const r=await plan(selection);assert.equal(r.stops[0].placeId,selection.entryId);assert.equal(r.stops.at(-1).placeId,selection.exitId);
  assert.deepEqual(r.geometry.coordinates[0],data.gates.find(g=>g.placeId===selection.entryId).location);
  assert.deepEqual(r.geometry.coordinates.at(-1),data.gates.find(g=>g.placeId===selection.exitId).location);
 }
 await assert.rejects(plan({presetId:'R02',entryId:'temple',exitId:west.placeId}),/入口和出口/);
 await assert.rejects(plan({presetId:'R02',entryId:west.placeId}),/入口和出口/);
});

test('personal trip revalidation preserves selected gates all the way into device-readable snapshot',async()=>{
 const store=new TravelStore(':memory:');
 try{
  const session=store.authenticate(store.createSession().token),create=createPersonalTripService({store,data,planRoads:plan});
  const trip=await create(session,{client_event_id:'cross-gates',selection:{presetId:'R02',entryId:west.placeId,exitId:south.placeId},stay_minutes:{temple:10}});
  assert.equal(trip.route.entrance_id,'west');assert.equal(trip.route.exit_id,'south');
  assert.equal(trip.route.stops[0].attraction_id,west.placeId);assert.equal(trip.route.stops.at(-1).attraction_id,south.placeId);
  await assert.rejects(create(session,{client_event_id:'bad-gates',selection:{presetId:'R02',entryId:'temple',exitId:south.placeId}}),{code:'INVALID_INPUT'});
 }finally{store.close();}
});
