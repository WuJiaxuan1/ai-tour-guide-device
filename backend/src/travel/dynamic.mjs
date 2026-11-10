import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function createDynamicInfo(root,clock=()=>Date.now()) {
  return {query(kind){
    let rows=[];try{const data=JSON.parse(readFileSync(resolve(root,'backend/data/dynamic-info.v1.json'),'utf8'));rows=Array.isArray(data[kind])?data[kind]:[];}catch{}
    const now=clock();const items=rows.filter(r=>r.verification_status==='verified'&&typeof r.source_ref==='string'&&r.source_ref&&Number.isFinite(Date.parse(r.valid_until))&&Date.parse(r.valid_until)>now&&Number.isFinite(Date.parse(r.updated_at))&&Date.parse(r.updated_at)<=now&&(kind!=='activities'||Date.parse(r.end_at)>now&&Date.parse(r.start_at)<=now+7*86400000));
    return {kind,items,status:items.length?'available':'unknown',queried_at:new Date(now).toISOString()};
  }};
}
