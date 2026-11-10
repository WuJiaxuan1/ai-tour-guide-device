import {unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {check,object} from './errors.mjs';
export function createTripDeletion({store,root,unlink=unlinkSync}){
 store.db.exec('CREATE TABLE IF NOT EXISTS media_purge (trip_id TEXT PRIMARY KEY, asset_ids TEXT NOT NULL)');
 const directory=resolve(root,'.local-work/travel-media');
 function purge(){
  for(const row of store.db.prepare('SELECT * FROM media_purge LIMIT 100').all()){
   let complete=true;
   for(const id of JSON.parse(row.asset_ids)){
    if(!/^[a-f0-9-]{36}$/.test(id)){complete=false;continue;}
    try{unlink(resolve(directory,id));}catch(e){if(e.code!=='ENOENT')complete=false;}
   }
   if(complete)store.db.prepare('DELETE FROM media_purge WHERE trip_id=?').run(row.trip_id);
  }
 }
 function remove(session,id,input){
  check(session.kind==='web','FORBIDDEN','请从网页删除行程。',403);object(input,['expected_version']);check(Number.isInteger(input.expected_version),'INVALID_INPUT','请提供当前行程版本。');
  store.transaction(()=>{
   const trip=store.getTrip(session,id);check(trip.version===input.expected_version,'VERSION_CONFLICT','行程已有更新，请刷新后再删除。',409);
   check(['planned','completed'].includes(trip.status),'INVALID_STATE','请先结束游览，再删除这次行程。',409);
   const busy=store.db.prepare("SELECT 1 FROM jobs WHERE trip_id=? AND status IN ('queued','running') UNION ALL SELECT 1 FROM chats WHERE trip_id=? AND status='processing' LIMIT 1").get(id,id);check(!busy,'TRIP_BUSY','问答或回忆仍在生成，请完成后再删除。',409);
   const assets=(trip.media||[]).map(m=>m.media_id);
   for(const row of store.db.prepare('SELECT body FROM jobs WHERE trip_id=?').all(id))for(const asset of JSON.parse(row.body).result?.assets||[])assets.push(asset.asset_id);
   check(assets.every(a=>typeof a==='string'&&/^[a-f0-9-]{36}$/.test(a)),'INVALID_ASSET','照片记录需要检查，暂不能删除。',500);
   store.db.prepare('INSERT INTO media_purge VALUES (?,?)').run(id,JSON.stringify([...new Set(assets)]));
   store.db.prepare('DELETE FROM chats WHERE owner_id=? AND trip_id=?').run(session.owner_id,id);
   store.db.prepare('DELETE FROM sessions WHERE trip_id=?').run(id);
   if(store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='device_binding'").get())store.db.prepare('UPDATE device_binding SET owner_id=NULL,trip_id=NULL,bound_until=NULL,code_hash=NULL,code_until=NULL WHERE trip_id=?').run(id);
   store.db.prepare('DELETE FROM receipts WHERE scope IN (?,?)').run('trip:'+id,'jobs:'+id);
   // Retain only a tombstone so replaying a successful creation cannot resurrect deleted data.
   store.db.prepare("UPDATE receipts SET response=? WHERE scope=? AND json_extract(response,'$.id')=?").run(JSON.stringify({deleted:true,id}),'owner:'+session.owner_id,id);
   store.db.prepare('DELETE FROM trips WHERE id=?').run(id);
  });
  purge();return{deleted:true,trip_id:id,media_cleanup_pending:Boolean(store.db.prepare('SELECT 1 FROM media_purge WHERE trip_id=?').get(id))};
 }
 purge();const timer=setInterval(purge,30000);timer.unref();
 return{remove,purge,close:()=>clearInterval(timer)};
}
