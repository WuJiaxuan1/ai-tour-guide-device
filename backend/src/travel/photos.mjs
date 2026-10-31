import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {check,object,idempotency} from './errors.mjs';
import {preparePhoto,renderPhoto} from './photo-renderer.mjs';
import {inspectTransparentPNG} from './png.mjs';

export function createPhotoService({store,root,render=renderPhoto,unlink=unlinkSync}){
 const directory=resolve(root,'.local-work/photo-creations');mkdirSync(directory,{recursive:true,mode:0o700});
 store.db.exec(`CREATE TABLE IF NOT EXISTS photo_creations (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, request_id TEXT NOT NULL, digest TEXT NOT NULL, status TEXT NOT NULL, body TEXT NOT NULL, UNIQUE(owner_id,request_id));
 CREATE TABLE IF NOT EXISTS photo_purge (id TEXT PRIMARY KEY, files TEXT NOT NULL);
 UPDATE photo_creations SET status='queued' WHERE status='running';`);
 const web=s=>check(s.kind==='web','FORBIDDEN','照片创作请在网页操作。',403);
 const safe=p=>{const {files,...rest}=p;return rest;};
 const read=(s,id)=>{web(s);const row=store.db.prepare('SELECT body,status FROM photo_creations WHERE id=? AND owner_id=?').get(id,s.owner_id);check(row&&row.status!=='deleted','NOT_FOUND','作品不存在。',404);return {...JSON.parse(row.body),status:row.status};};
 const save=(p,status)=>{const value={...p,status,version:p.version+1,updated_at:new Date(store.clock()).toISOString()};store.db.prepare('UPDATE photo_creations SET status=?,body=? WHERE id=?').run(status,JSON.stringify(value),p.id);return value;};
 function purge(){for(const row of store.db.prepare('SELECT * FROM photo_purge LIMIT 100').all()){let ok=true;for(const id of JSON.parse(row.files)){if(!/^[a-f0-9-]{36}$/.test(id)){ok=false;continue;}try{unlink(resolve(directory,id));}catch(e){if(e.code!=='ENOENT')ok=false;}}if(ok)store.db.prepare('DELETE FROM photo_purge WHERE id=?').run(row.id);}}
 let closed=false,running;
 async function work(){while(!closed){const row=store.db.prepare("SELECT body FROM photo_creations WHERE status='queued' ORDER BY rowid LIMIT 1").get();if(!row)break;let p=save(JSON.parse(row.body),'running');
  try{
   const output=await render({bytes:readFileSync(resolve(directory,p.files.original)),mime:p.source.mime_type,title:p.title,caption:p.caption,created_at:p.created_at,root});
   const validation=inspectTransparentPNG(output.transparent_stickers);
   for(const kind of ['memory_card','transparent_stickers'])writeFileSync(resolve(directory,p.files[kind]),output[kind],{mode:0o600});
   p.outputs=[{kind:'memory_card',mime_type:'image/png',width:1200,height:1600,bytes:output.memory_card.length},{kind:'transparent_stickers',mime_type:'image/png',width:validation.width,height:validation.height,bytes:output.transparent_stickers.length,validation}];p.error=null;save(p,'succeeded');
  }catch(e){for(const kind of ['memory_card','transparent_stickers'])try{unlink(resolve(directory,p.files[kind]));}catch{}p.error={code:e.code||'PHOTO_FAILED',message:e.code?e.message:'制作未完成，请重试。原照片仍保留。'};save(p,'failed');}
 }}
 const drain=()=>{if(!running)running=work().finally(()=>running=null);return running;};
 const list=s=>{web(s);return store.db.prepare("SELECT body,status FROM photo_creations WHERE owner_id=? AND status!='deleted' ORDER BY rowid DESC LIMIT 20").all(s.owner_id).map(r=>safe({...JSON.parse(r.body),status:r.status}));};
 async function upload(s,bytes,mime,eventId){
  web(s);idempotency(eventId);check(bytes.length<=8*1024*1024,'TOO_LARGE','请选择不超过8 MB的照片。',413);
  const digest=createHash('sha256').update(mime).update(bytes).digest('hex');
  const existing=()=>store.db.prepare('SELECT id,digest,status FROM photo_creations WHERE owner_id=? AND request_id=?').get(s.owner_id,eventId);
  const reuse=row=>{check(row.status!=='deleted','PHOTO_DELETED','这次上传已删除，请重新选择照片。',410);check(row.digest===digest,'IDEMPOTENCY_CONFLICT','上传标识已用于另一张照片。',409);return safe(read(s,row.id));};
  if(existing())return reuse(existing());
  check(store.db.prepare("SELECT COUNT(*) AS n FROM photo_creations WHERE owner_id=? AND status!='deleted'").get(s.owner_id).n<20,'PHOTO_LIMIT','最多保存20张照片，请先删除不需要的作品。',429);
  const decoded=await preparePhoto(bytes,mime);
  return store.transaction(()=>{
   if(existing())return reuse(existing());
   check(store.db.prepare("SELECT COUNT(*) AS n FROM photo_creations WHERE owner_id=? AND status!='deleted'").get(s.owner_id).n<20,'PHOTO_LIMIT','最多保存20张照片，请先删除不需要的作品。',429);
   const p={id:randomUUID(),version:1,status:'uploaded',mode:'photo_layout',source:decoded.source,title:'栖霞旅行记忆',caption:'把这一刻，留在栖霞。',created_at:new Date(store.clock()).toISOString(),files:{original:randomUUID(),memory_card:randomUUID(),transparent_stickers:randomUUID()},outputs:[]};
   writeFileSync(resolve(directory,p.files.original),bytes,{mode:0o600});
   try{store.db.prepare('INSERT INTO photo_creations VALUES (?,?,?,?,?,?)').run(p.id,s.owner_id,eventId,digest,p.status,JSON.stringify(p));}catch(e){try{unlink(resolve(directory,p.files.original));}catch{}throw e;}
   return safe(p);
  });
 }
 function generate(s,id,input){web(s);object(input,['title','caption']);const title=String(input.title??'栖霞旅行记忆').trim(),caption=String(input.caption??'把这一刻，留在栖霞。').trim();
  check(title&&[...title].length<=18&&caption&&[...caption].length<=60&&!/[\r\n\t\x00-\x1f]/.test(title+caption),'INVALID_INPUT','标题限1–18字，配文限1–60字，请勿输入换行。');
  const result=store.transaction(()=>{const p=read(s,id);if(['queued','running','succeeded'].includes(p.status)){check(p.title===title&&p.caption===caption,'PHOTO_BUSY','这张作品已提交；如需更换文案，请重新选图制作。',409);return p;}
   check(store.db.prepare("SELECT COUNT(*) AS n FROM photo_creations WHERE owner_id=? AND status IN ('queued','running')").get(s.owner_id).n<2,'PHOTO_BUSY','已有照片正在制作，请稍后再试。',429);
   return save({...p,title,caption,error:null},'queued');});queueMicrotask(()=>drain());return safe(result);
 }
 function asset(s,id,kind){const p=read(s,id);check(['original','memory_card','transparent_stickers'].includes(kind),'NOT_FOUND','图片不存在。',404);check(kind==='original'||p.status==='succeeded','NOT_READY','作品尚未制作完成。',409);return{bytes:readFileSync(resolve(directory,p.files[kind])),mime_type:kind==='original'?p.source.mime_type:'image/png',filename:kind+(kind==='original'&&p.source.mime_type==='image/jpeg'?'.jpg':'.png')};}
 function remove(s,id,input){object(input,['expected_version']);store.transaction(()=>{const p=read(s,id);check(p.version===input.expected_version,'VERSION_CONFLICT','作品状态已变化，请刷新后再删除。',409);check(!['queued','running'].includes(p.status),'PHOTO_BUSY','请等照片制作结束后再删除。',409);store.db.prepare('INSERT OR REPLACE INTO photo_purge VALUES (?,?)').run(id,JSON.stringify(Object.values(p.files)));store.db.prepare("UPDATE photo_creations SET status='deleted',body=? WHERE id=?").run(JSON.stringify({id,deleted:true}),id);});purge();return{deleted:true,cleanup_pending:Boolean(store.db.prepare('SELECT 1 FROM photo_purge WHERE id=?').get(id))};}
 purge();const timer=setInterval(purge,30000);timer.unref();queueMicrotask(()=>drain());
 return{list,upload,generate,asset,remove,get:(s,id)=>safe(read(s,id)),drain,purge,close:()=>{closed=true;clearInterval(timer);return running||Promise.resolve();}};
}
