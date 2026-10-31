import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export function loadBridgeEnv(env=process.env,root=resolve(fileURLToPath(new URL('.',import.meta.url)),'../../..')){
  let text='';try{text=readFileSync(resolve(root,'.env.local'),'utf8').replace(/^\uFEFF/,'');}catch{}
  const file={};
  for(const line of text.split(/\r?\n/)){
    const match=line.match(/^\s*(MCP_ENDPOINT|QIXIA_API_BASE_URL)\s*=(.*)$/);if(!match)continue;
    let value=match[2].trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);file[match[1]]=value;
  }
  return {...file,...env}; // systemd/runtime settings take precedence over a local file
}
export function decodeFrame(data){
  const text=typeof data==='string'?data:data instanceof ArrayBuffer?Buffer.from(data).toString('utf8'):ArrayBuffer.isView(data)?Buffer.from(data.buffer,data.byteOffset,data.byteLength).toString('utf8'):null;
  if(text===null||Buffer.byteLength(text)>32768)throw new Error('Invalid frame');
  const value=JSON.parse(text);if(!value||Array.isArray(value)||value.jsonrpc!=='2.0')throw new Error('Invalid frame');
  return JSON.stringify(value)+'\n';
}
export function runBridge({env=loadBridgeEnv(),command,WebSocketClass=WebSocket,spawnChild=spawn,exit=code=>process.exit(code),connectTimeoutMs=20000,heartbeatMs=25000}={}){
  let endpoint;try{endpoint=new URL(env.MCP_ENDPOINT);if(endpoint.protocol!=='wss:'||endpoint.username||endpoint.password)throw Error();}catch{console.error('MCP_ENDPOINT 配置无效。');exit(2);return;}
  if(!command?.length){console.error('缺少 MCP 子进程命令。');exit(2);return;}
  // Credentials stay in the bridge, not the tool subprocess.
  const childEnv={...env};delete childEnv.MCP_ENDPOINT;
  const child=spawnChild(command[0],command.slice(1),{stdio:['pipe','pipe','inherit'],env:childEnv});
  let socket,closed=false,queue=[],queuedBytes=0,timer,killTimer,heartbeat,heartbeatSeq=0;
  const heartbeatIds=new Set();
  const safeMessage=value=>{let text=String(value||'').replaceAll(endpoint.toString(),'[endpoint]');for(const value of endpoint.searchParams.values())if(value)text=text.replaceAll(value,'[secret]');return text.replace(/wss?:\/\/\S+/g,'[endpoint]').replace(/[A-Za-z0-9_-]{24,}/g,'[redacted]').slice(0,240);};
  const shutdown=code=>{
    if(closed)return;closed=true;clearTimeout(timer);clearInterval(heartbeat);
    try{socket?.close();}catch{}
    child.kill();
    if(child.exitCode!==null&&child.exitCode!==undefined)return exit(code);
    child.once('exit',()=>{clearTimeout(killTimer);exit(code);});
    killTimer=setTimeout(()=>{child.kill('SIGKILL');exit(code);},2000);
  };
  const flush=()=>{
    if(!socket||socket.readyState!==1)return;
    try{for(const line of queue)socket.send(line);queue=[];queuedBytes=0;}catch{shutdown(1);}
  };
  const rl=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
  rl.on('line',line=>{if(!line.trim()||closed)return;queuedBytes+=Buffer.byteLength(line);if(queuedBytes>131072)return shutdown(1);queue.push(line);flush();});
  child.on('error',()=>{console.error('MCP 子进程启动失败。');shutdown(1);});
  child.stdin.on('error',()=>shutdown(1));
  child.on('exit',()=>{if(!closed){closed=true;clearTimeout(timer);clearInterval(heartbeat);try{socket?.close();}catch{};exit(1);}});
  try{socket=new WebSocketClass(endpoint.toString());socket.binaryType='arraybuffer';}catch{shutdown(1);return;}
  timer=setTimeout(()=>{console.error('MCP WSS 连接超时。');shutdown(1);},connectTimeoutMs);
  socket.addEventListener('open',()=>{clearTimeout(timer);console.error('MCP WSS 连接已建立。');flush();heartbeat=setInterval(()=>{if(closed||socket.readyState!==1)return;const id='qixia-bridge-ping-'+(++heartbeatSeq);heartbeatIds.add(id);if(heartbeatIds.size>4)heartbeatIds.delete(heartbeatIds.values().next().value);try{socket.send(JSON.stringify({jsonrpc:'2.0',id,method:'ping'}));}catch{shutdown(1);}},heartbeatMs);heartbeat.unref?.();});
  socket.addEventListener('message',event=>{
    if(closed)return;
    try{const line=decodeFrame(event.data),frame=JSON.parse(line);if(!frame.method&&heartbeatIds.has(frame.id)){heartbeatIds.delete(frame.id);if(heartbeatSeq===1||heartbeatSeq%12===0)console.error(JSON.stringify({event:'keepalive_ack',accepted:!frame.error}));return;}child.stdin.write(line);}catch{console.error('MCP WSS 报文格式无效。');shutdown(1);}
  });
  socket.addEventListener('error',event=>{console.error(JSON.stringify({event:'wss_error',message:safeMessage(event.error?.message||event.message)}));shutdown(1);});
  socket.addEventListener('close',event=>{console.error(JSON.stringify({event:'wss_close',code:event.code,clean:event.wasClean,reason:safeMessage(event.reason)}));shutdown(1);});
  return {stop:()=>shutdown(0)};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const separator=process.argv.indexOf('--');
  const bridge=runBridge({command:separator>=0?process.argv.slice(separator+1):process.argv.slice(2)});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>bridge?.stop());
}
