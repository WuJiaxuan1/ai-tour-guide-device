import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceMeters,nearby} from '../src/services/distance.js';
import {timeline,cleanIds,reportText} from '../src/services/journey.js';
test('nearby ordering uses geodesic distance, never changes original ordering without location',()=>{const a={id:'a',location:[118.96,32.15]},b={id:'b',location:[118.97,32.16]};assert.equal(distanceMeters(a.location,a.location),0);assert.ok(distanceMeters(a.location,b.location)>1000);assert.equal(distanceMeters(null,b.location),null);assert.deepEqual(nearby([b,a],a.location),[a,b]);assert.deepEqual(nearby([b,a],null),[b,a]);});
test('timeline uses directed walking legs and stay times, missing leg suppresses invented arrival',()=>{const stops=[{id:'a'},{id:'b'},{id:'c'}],legs=[{fromId:'a',toId:'b',walkingSeconds:660}];const rows=timeline(stops,legs,{a:20},'09:00');assert.equal(rows[0].arrival,'09:00');assert.equal(rows[1].arrival,'09:31');assert.equal(rows[2].arrival,null);assert.ok(timeline(stops,legs,{},'').every(x=>x.arrival===null));});
test('draft validation removes unknown, duplicate and unavailable destinations',()=>{const lookup=id=>['a','b'].includes(id)?{navigationAvailable:true}:null;assert.deepEqual(cleanIds(['a','missing','a','b'],lookup),['a','b']);});
test('report distinguishes planned distance and manual visit confirmation',()=>{const s=reportText({startedAt:1,endedAt:2,visited:{a:1},route:{distanceMeters:123,stops:[{id:'a',name:'A'},{id:'b',name:'B'}]}});assert.match(s,/非实际轨迹里程/);assert.match(s,/手动确认/);assert.match(s,/未确认到访/);});
