import test from 'node:test';
import assert from 'node:assert/strict';
import {DemoTripClient,makeDemoSnapshot} from '../src/services/demo-trip.js';
const snapshot=ids=>({selectedPlaces:ids.map(id=>({id})),entryId:null,exitId:null,stayMinutes:{},focusedPlaceId:null,recentQuestions:[]});
function fixture(t){
  let current=null,updates=0,online=true;
  const entries=new Map(),storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
  const toTrip=(data,revision)=>({active:true,id:'demo',revision,expiresAt:Date.now()+7200000,
    selectedPlaces:data.selectedPlaces.map((p,i)=>({...p,name:p.id,order:i+1})),entry:null,exit:null,
    stayMinutes:data.stayMinutes,focusedPlace:null,recentQuestions:data.recentQuestions});
  const fetcher=async(url,opts)=>{
    if(!online)throw Error('offline');const endpoint=url.split('/').at(-1);
    const input=opts.body?JSON.parse(opts.body):{};
    if(endpoint==='status')return Response.json({enabled:true});
    if(endpoint==='start'){current=current||toTrip(input,1);return Response.json({trip:current});}
    if(endpoint==='session')return current?Response.json(current):Response.json({error:'ended'},{status:404});
    if(endpoint==='end'){current=null;return Response.json({active:false});}
    if(endpoint==='update'){updates++;if(!current||input.expectedRevision!==current.revision)return Response.json({error:'stale'},{status:409});
      current=toTrip(input,current.revision+1);return Response.json({trip:current});}
    throw Error(endpoint);
  };
  const clients=[];
  const client=(custom=fetcher)=>{const c=new DemoTripClient({fetcher:custom,storage,tokenFactory:()=> 'x'.repeat(64),debounceMs:60000});clients.push(c);return c;};
  t.after(()=>clients.forEach(c=>c.dispose()));
  return {client,fetcher,get current(){return current;},get updates(){return updates;},offline:()=>online=false,online:()=>online=true};
}
test('start and repeated snapshots do not trigger an endless synchronization loop',async t=>{
  const f=fixture(t),c=f.client();c.setSnapshot(snapshot(['a','b']));await c.restore();await c.start();
  assert.equal(c.state.phase,'synced');await c.flush();await c.flush();assert.equal(f.updates,0);
  c.setSnapshot(snapshot(['b']));await c.flush();assert.equal(f.updates,1);assert.equal(c.state.trip.revision,2);
  c.setSnapshot(snapshot(['b']));await c.flush();assert.equal(f.updates,1);
});
test('restored session syncs changes made on other pages and empty selections',async t=>{
  const f=fixture(t),first=f.client();first.setSnapshot(snapshot(['a']));await first.restore();await first.start();first.dispose();
  const second=f.client();second.setSnapshot(snapshot(['b']));await second.restore();
  assert.deepEqual(f.current.selectedPlaces.map(p=>p.id),['b']);
  second.setSnapshot(snapshot([]));await second.flush();assert.equal(f.current.selectedPlaces.length,0);
});
test('rapid changes are serialized, preserving only the newest pending snapshot',async t=>{
  const f=fixture(t);let release,entered;const started=new Promise(r=>entered=r);
  let delay=true;const c=f.client(async(url,opts)=>{
    if(url.endsWith('/update')&&delay){delay=false;entered();await new Promise(r=>release=r);}return f.fetcher(url,opts);
  });
  c.setSnapshot(snapshot(['a']));await c.restore();await c.start();
  c.setSnapshot(snapshot(['b']));const sync=c.flush();await started;
  c.setSnapshot(snapshot(['c']));c.setSnapshot(snapshot(['d']));release();await sync;
  assert.deepEqual(f.current.selectedPlaces.map(p=>p.id),['d']);assert.equal(f.updates,2);
});
test('ending during an update waits and never restores the old active session',async t=>{
  const f=fixture(t);let release,entered;const started=new Promise(r=>entered=r);
  const c=f.client(async(url,opts)=>{if(url.endsWith('/update')){entered();await new Promise(r=>release=r);}return f.fetcher(url,opts);});
  c.setSnapshot(snapshot(['a']));await c.restore();await c.start();
  c.setSnapshot(snapshot(['b']));const sync=c.flush();await started;const ending=c.end();release();await Promise.all([sync,ending]);
  assert.equal(f.current,null);assert.equal(c.state.phase,'idle');await c.flush();assert.equal(f.current,null);
});
test('network failure is visible and retry reconciles the newest selection',async t=>{
  const f=fixture(t),c=f.client();c.setSnapshot(snapshot(['a']));await c.restore();await c.start();f.offline();
  c.setSnapshot(snapshot(['b']));await c.flush();assert.equal(c.state.phase,'error');
  c.setSnapshot(snapshot(['c']));f.online();await c.retry();assert.equal(c.state.phase,'synced');
  assert.deepEqual(f.current.selectedPlaces.map(p=>p.id),['c']);
});
test('snapshot includes only submitted questions, not model replies or unsent draft',()=>{
  const questions=[{role:'assistant',content:'not user'},...[1,2,3,4].map(n=>({role:'user',content:'question'+n}))];
  const s=makeDemoSnapshot(['a'],questions,'b',(k,d)=>k==='qixia.stay'?{a:30}:d);
  assert.deepEqual(s.recentQuestions,['question2','question3','question4']);assert.equal(s.stayMinutes.a,30);assert.equal(s.focusedPlaceId,'b');
});

test('late retry response cannot revive an ended demo',async t=>{
  const f=fixture(t);let delay=false,release,entered;const started=new Promise(r=>entered=r);
  const c=f.client(async(url,opts)=>{
    const response=await f.fetcher(url,opts);
    if(delay&&url.endsWith('/session')){entered();await new Promise(r=>release=r);}
    return response;
  });
  c.setSnapshot(snapshot(['a']));await c.restore();await c.start();delay=true;
  const retry=c.retry();await started;await c.end();release();await retry;
  assert.equal(c.state.phase,'idle');assert.equal(c.state.trip,null);assert.equal(f.current,null);
});
