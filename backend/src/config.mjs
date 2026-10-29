import {readFileSync} from 'node:fs';
export function readConfig(root){
  let text='';try{text=readFileSync(root+'/.env.local','utf8').replace(/^\uFEFF/,'');}catch{}
  const file=Object.fromEntries(text.split(/\r?\n/).filter(line=>/^\s*[A-Z_]+\s*=/.test(line)).map(line=>{
    const i=line.indexOf('=');let value=line.slice(i+1).trim();if(/^(['"]).*\1$/.test(value))value=value.slice(1,-1);
    return [line.slice(0,i).trim(),value];
  }));
  const get=k=>file[k]||process.env[k]||'';
  return {webKey:get('AMAP_WEB_KEY'),jscode:get('AMAP_SECURITY_JSCODE'),serverKey:get('AMAP_SERVER_KEY')};
}
