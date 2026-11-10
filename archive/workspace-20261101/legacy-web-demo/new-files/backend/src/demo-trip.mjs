import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

export class DemoTripError extends Error {
  constructor(message,status=400){super(message);this.status=status;}
}
const hash = value => createHash('sha256').update(value).digest();
export function matchesSecret(value, expected){
  return typeof value === 'string' && typeof expected === 'string' &&
    expected.length >= 32 && timingSafeEqual(hash(value),hash(expected));
}
const validToken = token => typeof token === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(token);

// One Node process owns one atomic snapshot. Multi-process deployment needs a transactional store.
export function createDemoTripStore(root,known,options={}){
  const file=resolve(root,options.file||'.local-work/demo-trip.json');
  const now=options.now||Date.now,ttlMs=options.ttlMs||2*60*60*1000;
  const read=()=>{
    try {
      const record=JSON.parse(readFileSync(file,'utf8'));
      if(typeof record?.active!=='boolean'||(record.active&&
        (!record.snapshot||!Number.isSafeInteger(record.revision)||!Number.isFinite(record.expiresAt)||!record.tokenHash)))
        throw Error('Invalid snapshot');
      return record;
    } catch(error){
      if(error.code==='ENOENT')return null;
      throw new DemoTripError('演示存储暂不可用，请检查本机服务。',503);
    }
  };
  const write=value=>{
    try {mkdirSync(dirname(file),{recursive:true});writeFileSync(file+'.tmp',JSON.stringify(value),{mode:0o600});renameSync(file+'.tmp',file);}
    catch {throw new DemoTripError('演示数据未能保存，请重试。',503);}
  };
  const active=()=>{
    const record=read();if(!record?.active)return null;
    if(record.expiresAt<=now()){write({active:false,endedAt:now()});return null;}
    return record;
  };
  const place=id=>{const p=known.get(id);return p?{id:p.id,name:p.name,kind:p.kind||'poi'}:null;};
  const parseSnapshot=input=>{
    if(!input||typeof input!=='object'||Array.isArray(input))throw new DemoTripError('请选择有效的演示内容。');
    const ids=input.selectedPlaces;
    if(!Array.isArray(ids)||ids.length>known.size)throw new DemoTripError('地点列表格式不正确。');
    const used=new Set();
    const selectedPlaces=ids.map((item,index)=>{
      const id=item?.id,p=known.get(id);
      if(typeof id!=='string'||!p?.navigationAvailable||p.tags?.includes('出入口')||used.has(id))
        throw new DemoTripError('包含无法识别、重复或不支持的地点。');
      used.add(id);return {...place(id),order:index+1};
    });
    const gate=id=>{if(id===null||id===undefined)return null;const p=known.get(id);
      if(!p?.navigationAvailable||!p.tags?.includes('出入口'))throw new DemoTripError('出入口无效。');return place(id);};
    const focusedPlace=input.focusedPlaceId==null?null:place(input.focusedPlaceId);
    if(input.focusedPlaceId!=null&&!focusedPlace)throw new DemoTripError('正在查看的地点无效。');
    const minutes=input.stayMinutes??{};
    if(typeof minutes!=='object'||Array.isArray(minutes))throw new DemoTripError('停留时间格式不正确。');
    const stayMinutes={};
    for(const p of selectedPlaces){const n=minutes[p.id];if(n===undefined)continue;
      if(!Number.isInteger(n)||n<0||n>360)throw new DemoTripError('停留时间须为0至360分钟。');stayMinutes[p.id]=n;}
    const questions=input.recentQuestions??[];
    if(!Array.isArray(questions)||questions.length>3||questions.some(q=>typeof q!=='string'||q.length>2000))
      throw new DemoTripError('最多同步最近三条已发送问题，每条不超过2000字。');
    return {selectedPlaces,entry:gate(input.entryId),exit:gate(input.exitId),stayMinutes,focusedPlace,
      recentQuestions:questions.map(q=>q.trim()).filter(Boolean)};
  };
  const publicTrip=record=>({active:true,id:record.id,revision:record.revision,
    startedAt:record.startedAt,updatedAt:record.updatedAt,expiresAt:record.expiresAt,
    ...record.snapshot,routeStatus:'selection_only',navigationAvailable:false,locationAvailable:false,
    message:'这是网页最后成功同步的选择与输入；尚未同步真实道路路线、游览进度或GPS。'});
  const owns=(record,token)=>validToken(token)&&matchesSecret(hash(token).toString('hex'),record.tokenHash);
  const authorized=token=>{
    const record=active();if(!record)throw new DemoTripError('当前没有进行中的单人演示。',404);
    if(!owns(record,token))throw new DemoTripError('这个浏览器没有绑定当前演示。',401);return record;
  };
  return {
    start(token,input){
      if(!validToken(token))throw new DemoTripError('缺少有效的演示会话凭证。',401);
      const snapshot=parseSnapshot(input),prior=active();
      if(prior){if(!owns(prior,token))throw new DemoTripError('已有浏览器正在演示，请先在原浏览器结束，或等待自动过期。',409);
        return publicTrip(prior);}
      const timestamp=now(),record={id:randomUUID(),active:true,revision:1,tokenHash:hash(token).toString('hex'),
        startedAt:timestamp,updatedAt:timestamp,expiresAt:timestamp+ttlMs,snapshot};
      write(record);return publicTrip(record);
    },
    update(token,input,expectedRevision){
      const prior=authorized(token);
      if(expectedRevision!==prior.revision)throw new DemoTripError('行程版本已更新，请重新同步。',409);
      const snapshot=parseSnapshot(input);
      if(JSON.stringify(snapshot)===JSON.stringify(prior.snapshot))return publicTrip(prior);
      const record={...prior,snapshot,revision:prior.revision+1,updatedAt:now()};
      write(record);return publicTrip(record);
    },
    end(token){authorized(token);write({active:false,endedAt:now()});return {active:false,ended:true};},
    current(){const record=active();return record?publicTrip(record):{active:false,message:'当前没有进行中的单人演示行程。'};},
    session(token){return publicTrip(authorized(token));}
  };
}
