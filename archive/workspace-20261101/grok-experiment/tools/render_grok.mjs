// Render pinned upstream character code locally. Never connects to a device.
import {spawn} from 'node:child_process';
import {mkdir, readFile, writeFile, mkdtemp} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, join} from 'node:path';
const root = dirname(fileURLToPath(import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mapping = JSON.parse(await readFile(join(root, 'grok-mapping.json'), 'utf8'));
const out = join(root, 'grok-artwork');
await mkdir(out, {recursive:true});
const profile = await mkdtemp(join(root, 'grok-browser-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--window-size=600,600',
  `--user-data-dir=${profile}`, '--remote-debugging-port=19403',
  '--allow-file-access-from-files', 'about:blank'
], {stdio:'ignore'});
let ws;
class Cdp {
  constructor(socket) {
    this.socket=socket; this.id=0; this.pending=new Map();
    socket.addEventListener('message', e=>{
      const m=JSON.parse(e.data), p=this.pending.get(m.id);
      if(!p) return; this.pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    });
  }
  send(method, params={}) {
    return new Promise((resolve,reject)=>{
      const id=++this.id; this.pending.set(id,{resolve,reject});
      this.socket.send(JSON.stringify({id,method,params}));
    });
  }
  async eval(expression) {
    const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
}
try {
  let tab;
  for(let i=0;i<80;i++) {
    try {tab=(await fetch('http://127.0.0.1:19403/json/list').then(r=>r.json())).find(t=>t.type==='page');} catch {}
    if(tab) break; await sleep(100);
  }
  if(!tab) throw new Error('Browser debugging endpoint unavailable');
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.addEventListener('open',res);ws.addEventListener('error',rej);});
  const cdp=new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:466,height:466,deviceScaleFactor:1,mobile:false});
  await cdp.send('Page.navigate',{url:pathToFileURL(join(root,'vendor/grok-icon-study/replica/index.html')).href});
  let ready=false;
  for(let i=0;i<100;i++) {ready=await cdp.eval('!!window.GrokCharacter');if(ready)break;await sleep(100);}
  if(!ready) throw new Error('Character engine did not load');
  await cdp.eval(`(() => {
    window.__bots.forEach(b=>b.destroy());
    document.body.innerHTML='<svg id="face"></svg>';
    const style=document.createElement('style');
    style.textContent='html,body{margin:0!important;padding:0!important;width:466px;height:466px;overflow:hidden;background:#000!important}#face{display:block;width:320px;height:320px;margin:73px;color-scheme:dark;--disk:#000;--sand-bg-base:#000;}';
    document.head.appendChild(style);
    window.clock=0;Object.defineProperty(performance,'now',{value:()=>window.clock});
    window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};
    window.seed=12345;Math.random=()=>{window.seed=(Math.imul(window.seed,1664525)+1013904223)>>>0;return window.seed/4294967296;};
    return true;
  })()`);
  const report={source_commit:'b7e6cd48db4eeba13271c653c38e1ad0f48037b4',width:466,height:466,fps:8,frames:16,expressions:{}};
  for(const [name,spec] of Object.entries(mapping)) {
    const dir=join(out,name);await mkdir(dir,{recursive:true});
    await cdp.eval(`(() => {
      window.bot?.destroy();window.clock=0;window.seed=12345;
      const svg=document.getElementById('face');svg.replaceChildren();
      window.bot=new GrokCharacter(svg,{mode:'hold',state:${JSON.stringify(spec.state)},shape:'blob',color:'black',scheme:'dark',inkFlat:'#ffffff',eyeColor:'#000000',followPointer:false,loginWrap:true});
      const spec=${JSON.stringify(spec)};
      if(spec.eye!==undefined){window.bot.eyeFrom=spec.eye;window.bot.eyeTo=spec.eye;window.bot.eyeMorph.x=1;window.bot.eyeMorph.t=1;window.bot.eyeUntil=1e9;}
      window.bot.blinkUntil=1e9;window.bot.gazeUntil=1e9;window.bot.winkUntil=1e9;
      return true;
    })()`);
    for(let frame=0;frame<16;frame++) {
      const time=750+frame*125;
      await cdp.eval(`(() => {
        while(window.clock<${time}){window.clock=Math.min(${time},window.clock+1000/60);window.bot._tick(window.clock);}
        ${spec.wink ? 'window.bot.winkAt=window.clock-160;window.bot.winkEye=0;window.bot._paint(window.clock);' : ''}
        return window.bot.snapshot();
      })()`);
      const shot=await cdp.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:466,height:466,scale:1}});
      await writeFile(join(dir,`${String(frame).padStart(2,'0')}.png`),Buffer.from(shot.data,'base64'));
    }
    report.expressions[name]={...spec,snapshot:await cdp.eval('window.bot.snapshot()')};
    console.log(`Rendered ${name} -> ${spec.state}`);
  }
  await writeFile(join(out,'render-report.json'),JSON.stringify(report,null,2)+'\n');
} finally {
  if(ws?.readyState===1){try{ws.send(JSON.stringify({id:999999,method:'Browser.close'}));}catch{}ws.close();}
  chrome.kill();
}
