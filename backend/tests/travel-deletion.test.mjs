import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {TravelStore} from '../src/travel/store.mjs';
import {createPairing} from '../src/travel/pairing.mjs';
import {createTripDeletion} from '../src/travel/deletion.mjs';
function fixture(){const root=mkdtempSync(join(tmpdir(),'qixia-delete-')),store=new TravelStore(join(root,'test.sqlite')),session=store.authenticate(store.createSession().token),media=randomUUID(),asset=randomUUID(),unrelated=randomUUID(),dir=join(root,'.local-work/travel-media');mkdirSync(dir,{recursive:true});for(const id of [media,asset,unrelated])writeFileSync(join(dir,id),'fixture');const input={client_event_id:'create'};const trip=store.createTrip(session,input,()=>({status:'completed',route:{route_id:'R02'},media:[{media_id:media}],notes:[{text:'private note'}]}));return{root,store,session,trip,input,media,asset,unrelated,dir};}
test('owner deletion purges scoped records/assets and binding; creation retry cannot resurrect the trip',()=>{
 const f=fixture(),pair=createPairing({store:f.store,secret:()=> 'test'}),del=createTripDeletion(f);try{
 const device=f.store.createSession({ownerId:f.session.owner_id,tripId:f.trip.id,kind:'device'});pair.bind(f.session,f.trip.id,{code:pair.issue().pairing_code});
 const chat={client_event_id:'chat',conversation_id:'c',trip_id:f.trip.id,question:'private question'};f.store.beginChat(f.session,chat);f.store.finishChat(f.session,chat,{reply:'private answer'});
 f.store.db.prepare('INSERT INTO jobs VALUES (?,?,?,?)').run('job',f.trip.id,'succeeded',JSON.stringify({result:{assets:[{asset_id:f.asset}]}}));
 const foreign=f.store.authenticate(f.store.createSession().token);assert.throws(()=>del.remove(foreign,f.trip.id,{expected_version:1}),{code:'NOT_FOUND'});assert.throws(()=>del.remove(f.store.authenticate(device.token),f.trip.id,{expected_version:1}),{code:'FORBIDDEN'});
 const other=f.store.createTrip(f.session,{client_event_id:'other'},()=>({route:{route_id:'R01'},status:'planned'}));
 assert.equal(del.remove(f.session,f.trip.id,{expected_version:1}).media_cleanup_pending,false);
 assert.equal(existsSync(join(f.dir,f.media)),false);assert.equal(existsSync(join(f.dir,f.asset)),false);assert.equal(existsSync(join(f.dir,f.unrelated)),true);
 assert.equal(f.store.listTrips(f.session).length,1);assert.equal(f.store.getTrip(f.session,other.id).id,other.id);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM chats').get().n,0);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);assert.throws(()=>pair.session(),{code:'DEVICE_UNBOUND'});assert.throws(()=>f.store.authenticate(device.token),{code:'UNAUTHORIZED'});assert.throws(()=>f.store.createTrip(f.session,f.input,()=>({})),{code:'TRIP_DELETED'});
 assert.equal(JSON.stringify(f.store.db.prepare('SELECT response FROM receipts').all()).includes('private note'),false);
 }finally{del.close();f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
test('active trips, stale state and in-flight work prevent deletion',()=>{
 const f=fixture(),del=createTripDeletion(f);try{assert.throws(()=>del.remove(f.session,f.trip.id,{expected_version:0}),{code:'VERSION_CONFLICT'});f.store.db.prepare('INSERT INTO jobs VALUES (?,?,?,?)').run('job',f.trip.id,'running','{}');assert.throws(()=>del.remove(f.session,f.trip.id,{expected_version:1}),{code:'TRIP_BUSY'});f.store.db.prepare('DELETE FROM jobs').run();f.store.mutate(f.session,f.trip.id,{client_event_id:'active'},t=>{t.status='active';});assert.throws(()=>del.remove(f.session,f.trip.id,{expected_version:2}),{code:'INVALID_STATE'});assert.ok(existsSync(join(f.dir,f.media)));}finally{del.close();f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
test('failed file cleanup remains durable and retries after reopening',()=>{
 const f=fixture();let del=createTripDeletion({...f,unlink:()=>{const e=Error('locked');e.code='EACCES';throw e;}});try{assert.equal(del.remove(f.session,f.trip.id,{expected_version:1}).media_cleanup_pending,true);del.close();f.store.close();f.store=new TravelStore(join(f.root,'test.sqlite'));del=createTripDeletion({...f,unlink:unlinkSync});assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM media_purge').get().n,0);assert.equal(existsSync(join(f.dir,f.media)),false);assert.equal(existsSync(join(f.dir,f.unrelated)),true);}finally{del.close();f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
