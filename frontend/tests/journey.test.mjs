import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceMeters,nearby,scenicOrder} from '../src/services/distance.js';
import {timeline,cleanIds,reportText} from '../src/services/journey.js';
test('nearby ordering uses geodesic distance, never changes original ordering without location',()=>{const a={id:'a',location:[118.96,32.15]},b={id:'b',location:[118.97,32.16]};assert.equal(distanceMeters(a.location,a.location),0);assert.ok(distanceMeters(a.location,b.location)>1000);assert.equal(distanceMeters(null,b.location),null);assert.deepEqual(nearby([b,a],a.location),[a,b]);assert.deepEqual(nearby([b,a],null),[b,a]);});
test('timeline uses directed walking legs and stay times, missing leg suppresses invented arrival',()=>{const stops=[{id:'a'},{id:'b'},{id:'c'}],legs=[{fromId:'a',toId:'b',walkingSeconds:660}];const rows=timeline(stops,legs,{a:20},'09:00');assert.equal(rows[0].arrival,'09:00');assert.equal(rows[1].arrival,'09:31');assert.equal(rows[2].arrival,null);assert.ok(timeline(stops,legs,{},'').every(x=>x.arrival===null));});
test('draft validation removes unknown, duplicate and unavailable destinations',()=>{const lookup=id=>['a','b'].includes(id)?{navigationAvailable:true}:null;assert.deepEqual(cleanIds(['a','missing','a','b'],lookup),['a','b']);});
test('report distinguishes planned distance and manual visit confirmation',()=>{const s=reportText({startedAt:1,endedAt:2,visited:{a:1},route:{distanceMeters:123,stops:[{id:'a',name:'A'},{id:'b',name:'B'}]}});assert.match(s,/非实际轨迹里程/);assert.match(s,/手动确认/);assert.match(s,/未确认到访/);});

test('selection validation preserves more than eight available destinations',()=>{const ids=Array.from({length:15},(_,i)=>'poi-'+i);assert.deepEqual(cleanIds(ids,id=>({id,navigationAvailable:true})),ids);});
test('scenic grouping outranks GPS distance, temple exempt, placeholders before religious places',()=>{
 const photo={image:'photo',images:['photo']},origin=[118.96,32.15];
 const nodes=[{id:'pagoda',...photo,location:origin},{id:'bell-drum-tower',images:[],location:origin},{id:'far',...photo,location:[118.98,32.15]},{id:'temple',religious:true,...photo,location:origin}];
 assert.deepEqual(scenicOrder(nodes,origin).map(p=>p.id),['temple','far','bell-drum-tower','pagoda']);
 assert.deepEqual(scenicOrder(nodes,null).map(p=>p.id),['far','temple','bell-drum-tower','pagoda']);
});

test('return visits have independent confirmations and arrival times',()=>{const stops=[{id:'a',stopId:'s1',name:'A'},{id:'b',stopId:'s2',name:'B'},{id:'a',stopId:'s3',name:'A'}];const trip={startedAt:1,visited:{s1:1},route:{distanceMeters:null,stops}};const text=reportText(trip);assert.match(text,/3\. A — 未确认到访/);assert.match(text,/未提供/);const legs=[{fromStopId:'s1',toStopId:'s2',walkingSeconds:120},{fromStopId:'s2',toStopId:'s3',walkingSeconds:180}];assert.deepEqual(timeline(stops,legs,{s1:10,s2:20},'09:00').map(x=>x.arrival),['09:00','09:12','09:35']);});
