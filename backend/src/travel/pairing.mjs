import {randomInt,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {check,object} from './errors.mjs';
const hash=v=>createHash('sha256').update(v).digest();
export function createPairing({store,secret}){
 store.db.exec('CREATE TABLE IF NOT EXISTS device_binding (id INTEGER PRIMARY KEY CHECK(id=1), owner_id TEXT, trip_id TEXT, bound_until INTEGER, code_hash TEXT, code_until INTEGER)');
 store.db.exec('CREATE TABLE IF NOT EXISTS watch_pairings (token_hash TEXT PRIMARY KEY, code_hash TEXT UNIQUE, code_until INTEGER NOT NULL, owner_id TEXT, trip_id TEXT, bound_until INTEGER, revoked INTEGER NOT NULL DEFAULT 0)');
 const attempts=new Map();
 const authorize=token=>{const expected=secret();check(expected&&typeof token==='string'&&timingSafeEqual(hash(token),hash(expected)),'UNAUTHORIZED','设备桥接身份无效。',401);};
 const beginWatch=()=>{
  const now=store.clock();store.db.prepare('DELETE FROM watch_pairings WHERE COALESCE(bound_until,code_until)<?').run(now);
  check(store.db.prepare('SELECT COUNT(*) AS n FROM watch_pairings').get().n<256,'RATE_LIMITED','配对请求较多，请稍后重试。',429);
  const token=randomBytes(32).toString('base64url');let code;
  do{code=String(randomInt(10000000,100000000));}while(store.db.prepare('SELECT 1 FROM watch_pairings WHERE code_hash=?').get(hash(code).toString('hex'))||store.db.prepare('SELECT 1 FROM device_binding WHERE code_hash=? AND code_until>?').get(hash(code).toString('hex'),now));
  store.db.prepare('INSERT INTO watch_pairings(token_hash,code_hash,code_until) VALUES(?,?,?)').run(hash(token).toString('hex'),hash(code).toString('hex'),now+300000);
  return {pairing_code:code,claim_token:token,expires_in_seconds:300};
 };
 const watchRow=token=>{check(typeof token==='string'&&token.length===43,'UNAUTHORIZED','设备配对身份无效。',401);const row=store.db.prepare('SELECT * FROM watch_pairings WHERE token_hash=?').get(hash(token).toString('hex'));check(row&&!row.revoked&&(row.bound_until||row.code_until)>store.clock(),'UNAUTHORIZED','设备配对已到期，请重新获取配对码。',401);return row;};
 const watchSession=token=>{const row=watchRow(token);check(row.trip_id&&row.bound_until>store.clock(),'DEVICE_UNBOUND','请在网页填写配对码。',409);const device=session();check(device.trip_id===row.trip_id&&device.owner_id===row.owner_id,'UNAUTHORIZED','设备行程已变更，请重新配对。',401);store.getTrip(device,row.trip_id);return {...device,id:'watch:'+hash(token).toString('hex').slice(0,16)};};
 const watchStatus=token=>{const row=watchRow(token);if(!row.trip_id)return {bound:false,expires_at:new Date(row.code_until).toISOString()};const device=watchSession(token);return {bound:true,trip_id:device.trip_id,expires_at:new Date(device.expires_at).toISOString()};};
 const status=(web,id)=>{store.getTrip(web,id);const row=store.db.prepare('SELECT * FROM device_binding WHERE id=1').get();return row?.owner_id===web.owner_id&&row.trip_id===id&&row.bound_until>store.clock()?{bound:true,trip_id:id,expires_at:new Date(row.bound_until).toISOString(),watch_linked:Boolean(store.db.prepare('SELECT 1 FROM watch_pairings WHERE owner_id=? AND trip_id=? AND revoked=0 AND bound_until>?').get(web.owner_id,id,store.clock()))}:{bound:false};};
 const issue=()=>{const code=String(randomInt(10000000,100000000)),until=store.clock()+5*60000;store.db.prepare('INSERT INTO device_binding(id,code_hash,code_until) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET code_hash=excluded.code_hash,code_until=excluded.code_until').run(hash(code).toString('hex'),until);return{pairing_code:code,expires_in_seconds:300,instruction:'请在网页的我的路线中打开连接我的小智，输入这8位配对码。请勿公开配对码。'};};
 const bind=(session,id,input)=>{
  object(input,['code']);check(session.kind==='web','FORBIDDEN','请从网页绑定小智。',403);store.getTrip(session,id);check(typeof input.code==='string'&&/^\d{8}$/.test(input.code),'INVALID_INPUT','请输入小智提供的8位配对码。');
  const rate=attempts.get(session.owner_id)||{at:store.clock(),count:0};if(store.clock()-rate.at>60000){rate.at=store.clock();rate.count=0;}attempts.set(session.owner_id,rate);check(++rate.count<=5,'RATE_LIMITED','尝试较多，请一分钟后再试。',429);
  return store.transaction(()=>{
   const digest=hash(input.code).toString('hex'),watch=store.db.prepare('SELECT * FROM watch_pairings WHERE code_hash=? AND revoked=0 AND code_until>? AND trip_id IS NULL').get(digest,store.clock());
   const row=store.db.prepare('SELECT * FROM device_binding WHERE id=1').get();
   check(watch||row?.code_hash&&row.code_until>store.clock()&&row.code_hash===digest,'PAIRING_INVALID','配对码无效或已过期，请让枫叶精灵重新提供。',409);
   const until=store.clock()+12*3600000;
   store.db.prepare('INSERT INTO device_binding(id,owner_id,trip_id,bound_until) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,trip_id=excluded.trip_id,bound_until=excluded.bound_until,code_hash=NULL,code_until=NULL').run(session.owner_id,id,until);
   store.db.prepare('UPDATE watch_pairings SET revoked=1 WHERE trip_id IS NOT NULL').run();
   if(watch)store.db.prepare('UPDATE watch_pairings SET owner_id=?,trip_id=?,bound_until=?,code_hash=NULL WHERE token_hash=?').run(session.owner_id,id,until,watch.token_hash);
   store.appendEvent(id,'device_bound',{expires_at:new Date(until).toISOString(),watch_linked:Boolean(watch)},'web');
   return {bound:true,trip_id:id,expires_at:new Date(until).toISOString(),watch_linked:Boolean(watch)};
  });
 };
 const session=()=>{const row=store.db.prepare('SELECT * FROM device_binding WHERE id=1').get();check(row?.owner_id&&row.bound_until>store.clock(),'DEVICE_UNBOUND','请先获取配对码，并在网页中连接本次行程。',409);return{id:'xiaozhi-demo-device',owner_id:row.owner_id,trip_id:row.trip_id,kind:'device',expires_at:row.bound_until};};
 return {authorize,issue,bind,session,beginWatch,watchStatus,watchSession,status};
}
