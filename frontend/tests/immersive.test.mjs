import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {hasTempleExperience,eligibleImmersiveReminder} from '../../shared/immersive.mjs';
test('only routes containing temple carry an immersive entry, including old trip snapshots',()=>{
 assert.equal(hasTempleExperience({stops:[{placeId:'temple'}]}),true);
 assert.equal(hasTempleExperience({stops:[{attraction_id:'temple'}]}),true);
 assert.equal(hasTempleExperience({stops:[{attraction_id:'palace'}]}),false);
 assert.equal(hasTempleExperience(null),false);
});
test('automatic prompt requires this active trip and fresh temple proximity; dismissed reminders do not reopen',()=>{
 const trip={id:'t',status:'active',reminders:[{id:'r',experience_id:'temple-ming-life',status:'pending'}]},nav={trip_id:'t',location:{freshness:'fresh'},current_place:{attraction_id:'temple'}};
 assert.equal(eligibleImmersiveReminder(trip,nav).id,'r');
 for(const freshness of ['stale','low_accuracy','awaiting_update'])assert.equal(eligibleImmersiveReminder(trip,{...nav,location:{freshness}}),null);
 assert.equal(eligibleImmersiveReminder({...trip,status:'paused'},nav),null);
 assert.equal(eligibleImmersiveReminder(trip,{...nav,trip_id:'other'}),null);
 assert.equal(eligibleImmersiveReminder(trip,{...nav,current_place:{attraction_id:'palace'}}),null);
 assert.equal(eligibleImmersiveReminder({...trip,reminders:[{...trip.reminders[0],status:'dismissed_on_web'}]},nav),null);
});
test('embedded story accepts only matching parent/origin/channel and propagates save failure',async()=>{
 let receive,seq=0;const sent=[],parent={postMessage:(data,origin)=>sent.push({data,origin})};
 const context={parent,location:{origin:'https://travel.test',hash:'#channel=one'},URLSearchParams,crypto:{randomUUID:()=>String(++seq)},addEventListener:(event,fn)=>{if(event==='message')receive=fn;},setTimeout:()=>1,clearTimeout:()=>{}};context.window=context;
 vm.runInNewContext(readFileSync(new URL('../public/immersive/qixia-temple/integration.js',import.meta.url),'utf8'),context);
 let ready=false;context.travelBridge.ready.then(()=>ready=true);
 const event={source:parent,origin:'https://travel.test',data:{app:'qixia-immersive',channel:'one',type:'init',state:null}};
 receive({...event,origin:'https://other.test'});receive({...event,source:{}});receive({...event,data:{...event.data,channel:'wrong'}});await Promise.resolve();assert.equal(ready,false);
 receive(event);await context.travelBridge.ready;assert.equal(ready,true);
 const call=context.travelBridge.act('choice','home-books');const request=sent.at(-1);assert.equal(request.data.choice,'home-books');assert.equal(request.origin,'https://travel.test');
 receive({...event,data:{...event.data,type:'result',id:request.data.id,error:'保存失败'}});await assert.rejects(call,/保存失败/);
});
