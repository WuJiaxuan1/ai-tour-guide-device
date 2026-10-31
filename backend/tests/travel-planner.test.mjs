import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPresetService} from '../src/presets.mjs';
import {TravelStore} from '../src/travel/store.mjs';
import {createTripService} from '../src/travel/trips.mjs';
import {recommend} from '../src/travel/planner.mjs';

const root=new URL('../..',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');
const catalog=['places','facilities'].flatMap(f=>JSON.parse(readFileSync(new URL(`../../frontend/src/content/${f}.json`,import.meta.url),'utf8')));
const {data}=createPresetService(root,catalog);
export const preferences={entrance_id:'west',exit_id:'west',duration:'half_day',intensity:'easy',has_elderly:false,has_children:false};

test('recommendation preserves official stops, filters exit, and never fills missing results',()=>{
 const out=recommend(data,preferences);assert.equal(out.count,2);
 assert.deepEqual(out.routes.map(r=>r.route_id),['R02','R01']);
 assert.deepEqual(out.routes[0].stops.map(s=>s.stop_id),data.routes.find(r=>r.routeId==='R02').stops.map(s=>s.stopId));
 assert.equal(recommend(data,{...preferences,exit_id:'south'}).count,0);
 assert.equal(recommend(data,{...preferences,entrance_id:'south',exit_id:'south'}).count,1);
 assert.throws(()=>recommend(data,{...preferences,limit:4}));
});
test('elderly and children require the intersection of verified filter rows, not a union',()=>{
 const altered=structuredClone(data);altered.rules.find(r=>r.gate==='west'&&r.duration==='half'&&r.intensity==='easy'&&r.companions==='child').routeIds=['R01'];
 const out=recommend(altered,{...preferences,has_elderly:true,has_children:true,intensity:'energetic'});
 assert.deepEqual(out.routes.map(r=>r.route_id),['R01']);assert.equal(out.effective_preferences.intensity,'easy');
 assert.equal(out.effective_preferences.has_elderly,true);assert.equal(out.effective_preferences.has_children,true);
});
test('trip snapshot survives restart; ownership, versions, repeats, and incomplete roads are enforced',()=>{
 const dir=mkdtempSync(join(tmpdir(),'qixia-travel-')),path=join(dir,'db.sqlite');let store=new TravelStore(path);
 try {
 const credential=store.createSession(),session=store.authenticate(credential.token),trips=createTripService(store,data);
 const input={client_event_id:'create-1',preferences,route_id:'R02',revision:1};
 let trip=trips.create(session,input);assert.equal(trips.create(session,input).id,trip.id);
 assert.throws(()=>trips.create(session,{...input,route_id:'R01'}),/同一请求/);
 assert.throws(()=>store.getTrip(store.authenticate(store.createSession().token),trip.id),/没有找到/);
 const start={client_event_id:'start-1',expected_version:trip.version,action:'start'};
 trip=trips.command(session,trip.id,start);assert.equal(trips.command(session,trip.id,start).version,trip.version);
 assert.throws(()=>trips.command(session,trip.id,{...start,client_event_id:'different'}),{code:'VERSION_CONFLICT'});
 const repeated=trip.route.stops.find((s,i,a)=>a.some((t,j)=>j>i&&t.attraction_id===s.attraction_id));assert.ok(repeated);
 trip=trips.command(session,trip.id,{client_event_id:'visit-1',expected_version:trip.version,action:'confirm_visit',stop_id:repeated.stop_id});
 assert.equal(trip.route.stops.filter(s=>s.status==='visited').length,1);
 trip=trips.command(session,trip.id,{client_event_id:'end-1',expected_version:trip.version,action:'complete'});
 assert.equal(trip.visits.length,1);assert.ok(trip.route.stops.some(s=>s.status==='pending'));
 const other=trips.create(session,{...input,client_event_id:'create-2',route_id:'R01'});
 assert.throws(()=>trips.command(session,other.id,{client_event_id:'start-2',expected_version:1,action:'start'}),/不能开始/);
 store.close();store=new TravelStore(path);assert.equal(store.getTrip(store.authenticate(credential.token),trip.id).status,'completed');
 assert.equal(store.events(session,trip.id).length,4);
 } finally {store.close();rmSync(dir,{recursive:true,force:true});}
});
