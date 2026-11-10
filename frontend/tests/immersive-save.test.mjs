import test from 'node:test';
import assert from 'node:assert/strict';
import {saveImmersiveAction} from '../src/services/immersive-save.mjs';

test('immersive choice needs one successful commit and does not wait for a navigation read',async()=>{
 const calls=[],trip={id:'trip',version:4},input={client_event_id:'choice-id',choice_id:'home-books'};
 const saved=await saveImmersiveAction(async(path,options)=>{calls.push({path,options});return {...trip,version:5};},trip,input);
 assert.equal(calls.length,1);assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].options.body.expected_version,4);assert.equal(saved.version,5);
});
test('version conflict refreshes once and preserves event identity; ordinary failures propagate',async()=>{
 const calls=[];const request=async(path,options)=>{calls.push({path,options});if(calls.length===1)throw Object.assign(Error('conflict'),{code:'VERSION_CONFLICT'});return options?{id:'trip',version:7}:{id:'trip',version:6};};
 assert.equal((await saveImmersiveAction(request,{id:'trip',version:4},{client_event_id:'same'})).version,7);
 assert.equal(calls.length,3);assert.equal(calls[2].options.body.expected_version,6);assert.equal(calls[2].options.body.client_event_id,'same');
 let count=0;await assert.rejects(saveImmersiveAction(async()=>{count++;throw Error('offline');},{id:'trip',version:1},{}),/offline/);assert.equal(count,1);
});
test('switching trip during conflict recovery prevents writing the old experience',async()=>{
 let current=true,writes=0;await assert.rejects(saveImmersiveAction(async(path,options)=>{if(options){writes++;throw Object.assign(Error('conflict'),{code:'VERSION_CONFLICT'});}current=false;return {id:'trip',version:3};},{id:'trip',version:1},{},()=>current),/行程已切换/);assert.equal(writes,1);
});
