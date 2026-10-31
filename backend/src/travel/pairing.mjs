import {randomInt,createHash,timingSafeEqual} from 'node:crypto';
import {check,object} from './errors.mjs';
const hash=v=>createHash('sha256').update(v).digest();
export function createPairing({store,secret}){
 store.db.exec('CREATE TABLE IF NOT EXISTS device_binding (id INTEGER PRIMARY KEY CHECK(id=1), owner_id TEXT, trip_id TEXT, bound_until INTEGER, code_hash TEXT, code_until INTEGER)');
 const attempts=new Map();
 const authorize=token=>{const expected=secret();check(expected&&typeof token==='string'&&timingSafeEqual(hash(token),hash(expected)),'UNAUTHORIZED','设备桥接身份无效。',401);};
 const issue=()=>{const code=String(randomInt(10000000,100000000)),until=store.clock()+5*60000;store.db.prepare('INSERT INTO device_binding(id,code_hash,code_until) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET code_hash=excluded.code_hash,code_until=excluded.code_until').run(hash(code).toString('hex'),until);return{pairing_code:code,expires_in_seconds:300,instruction:'请在网页的我的路线中打开连接我的小智，输入这8位配对码。请勿公开配对码。'};};
 const bind=(session,id,input)=>{
  object(input,['code']);check(session.kind==='web','FORBIDDEN','请从网页绑定小智。',403);store.getTrip(session,id);check(typeof input.code==='string'&&/^\d{8}$/.test(input.code),'INVALID_INPUT','请输入小智提供的8位配对码。');
  const rate=attempts.get(session.owner_id)||{at:store.clock(),count:0};if(store.clock()-rate.at>60000){rate.at=store.clock();rate.count=0;}attempts.set(session.owner_id,rate);check(++rate.count<=5,'RATE_LIMITED','尝试较多，请一分钟后再试。',429);
  return store.transaction(()=>{const row=store.db.prepare('SELECT * FROM device_binding WHERE id=1').get();check(row?.code_hash&&row.code_until>store.clock()&&row.code_hash===hash(input.code).toString('hex'),'PAIRING_INVALID','配对码无效或已过期，请让小智重新提供。',409);const until=store.clock()+12*3600000;store.db.prepare('UPDATE device_binding SET owner_id=?,trip_id=?,bound_until=?,code_hash=NULL,code_until=NULL WHERE id=1').run(session.owner_id,id,until);store.appendEvent(id,'device_bound',{expires_at:new Date(until).toISOString()},'web');return{bound:true,trip_id:id,expires_at:new Date(until).toISOString()};});
 };
 const session=()=>{const row=store.db.prepare('SELECT * FROM device_binding WHERE id=1').get();check(row?.owner_id&&row.bound_until>store.clock(),'DEVICE_UNBOUND','请先获取配对码，并在网页中连接本次行程。',409);return{id:'xiaozhi-demo-device',owner_id:row.owner_id,trip_id:row.trip_id,kind:'device',expires_at:row.bound_until};};
 return {authorize,issue,bind,session};
}
