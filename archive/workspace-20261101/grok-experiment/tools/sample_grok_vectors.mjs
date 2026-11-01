// Sample the original JS motion as vector poses. No browser or device access.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(root,'grok-v4');fs.mkdirSync(out,{recursive:true});
class Element {
  constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.style={setProperty(k,v){this[k]=v;}};}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='style')for(const p of String(v).split(';')){const [a,b]=p.split(':');if(a)this.style[a.trim()]=b?.trim();}}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}
  appendChild(el){el.remove();el.parent=this;this.children.push(el);return el;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}
  addEventListener(){} removeEventListener(){}
  getBoundingClientRect(){return {width:430,height:430,left:0,top:0};}
}
let clock=0,seed=12345;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const math=Object.create(Math);math.random=random;
const context={document:{createElementNS:(ns,t)=>new Element(t),documentElement:new Element('html')},
  performance:{now:()=>clock},requestAnimationFrame:()=>0,cancelAnimationFrame(){},
  addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false}),Math:math,console};
context.window=context;vm.createContext(context);
for(const file of ['geometry-data.js','src/math.js','src/tables.js','src/pose.js','src/tricks.js','src/eyes.js','src/fx.js','src/character.js'])
  vm.runInContext(fs.readFileSync(path.join(root,'vendor/grok-icon-study/replica',file),'utf8'),context,{filename:file});
const counts=[64,48,48,24,24],coords=counts.reduce((a,b)=>a+b,0)*2,words=coords+5;
const mapping={...JSON.parse(fs.readFileSync(path.join(root,'grok-mapping.json'),'utf8')),listening:{state:'listening',match:'lifecycle'}};
const N=240,dt=50;
const I=[1,0,0,1,0,0];
function mul(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
function matrix(text){let m=I;for(const part of (text||'').matchAll(/(translate|scale|rotate|matrix)\(([^)]+)\)/g)){
  const n=part[2].trim().split(/[ ,]+/).map(Number);let t=I;
  if(part[1]==='translate')t=[1,0,0,1,n[0],n[1]||0];
  if(part[1]==='scale')t=[n[0],0,0,n[1]??n[0],0,0];
  if(part[1]==='matrix')t=n;
  if(part[1]==='rotate'){const a=n[0]*Math.PI/180;t=[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0];if(n.length===3)t=mul(mul([1,0,0,1,n[1],n[2]],t),[1,0,0,1,-n[1],-n[2]]);}
  m=mul(m,t);
}return m;}
function resample(points,count){const lengths=[0];for(let i=1;i<=points.length;i++){const a=points[i-1],b=points[i%points.length];lengths.push(lengths.at(-1)+Math.hypot(a[0]-b[0],a[1]-b[1]));}let edge=0;return Array.from({length:count},(_,i)=>{const distance=lengths.at(-1)*i/count;while(edge+1<points.length&&lengths[edge+1]<distance)edge++;const a=points[edge],b=points[(edge+1)%points.length],t=(distance-lengths[edge])/(lengths[edge+1]-lengths[edge]||1);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];});}
function polygon(el,count,parent=I,eye=false){const d=el.getAttribute('d');let points;
  if(!d)points=Array.from({length:count},()=>[114.2705,114.2705]);
  else if(eye){const n=d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g).map(Number);points=Array.from({length:n.length/2},(_,i)=>[n[i*2],n[i*2+1]]);if(points.length!==count)points=resample(points,count);}
  else points=resample(context.GROK_MATH.flattenPath(d,2),count);
  const m=mul(parent,matrix(el.getAttribute('transform')));
  return points.map(([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);
}
function opacity(el,parent=1){return el.style.display==='none'?0:parent*Number(el.style.opacity??el.getAttribute('opacity')??1);}
const states=[],report={source_commit:'b7e6cd48db4eeba13271c653c38e1ad0f48037b4',frames:N,frame_ms:dt,points:counts,expressions:{},
  design:'Original engine sampled as vector poses; firmware interpolates frames and morphs states. No GIF decoding.',
  limitations:['Particle ribbons/confetti are omitted. Body, eyes, blinking, gaze and thinking dots retained.','12-second vector cycles have a 2-second Hermite seam; not the full interactive JS physics engine.']};
for(const [name,spec] of Object.entries(mapping)){
  clock=0;seed=12345;const svg=new Element('svg');
  const bot=new context.GrokCharacter(svg,{mode:'hold',state:spec.state,shape:'blob',color:'black',scheme:'dark',inkFlat:'#ffffff',eyeColor:'#000000',followPointer:false,loginWrap:true});
  // Keep individual variants, while permitting natural blinks/gaze/body motion.
  if(spec.eye!==undefined){bot.eyeFrom=spec.eye;bot.eyeTo=spec.eye;bot.eyeMorph.x=bot.eyeMorph.t=1;bot.eyeUntil=1e12;}
  const frames=[];
  for(let i=0;i<N;i++){
    const target=2000+i*dt;
    while(clock<target){clock=Math.min(target,clock+1000/120);bot._tick(clock);}
    if(spec.wink){bot.winkAt=clock-(i*dt%2500);bot.winkEye=0;bot._paint(clock);}
    const group=matrix(bot.group.getAttribute('transform')),alpha=opacity(bot.group);
    const els=[bot.body,...bot.eyeEls,...bot.fx.dots];
    const polygons=els.map((el,k)=>polygon(el,counts[k],k<3?group:I,k===1||k===2));
    frames.push([...polygons.flat(2),opacity(bot.body,alpha)*255,opacity(bot.eyeEls[0],alpha)*255,opacity(bot.eyeEls[1],alpha)*255,opacity(bot.fx.dots[0])*255,opacity(bot.fx.dots[1])*255]);
  }
  // Match both position and velocity at the cycle boundary; no hard rewind.
  const seam=40,start=N-seam,a=frames[start].slice(),b=frames[0],
    va=a.map((_,k)=>(frames[start+1][k]-frames[start-1][k])/2*seam),vb=a.map((_,k)=>(frames[1][k]-frames[0][k])*seam);
  for(let i=start;i<N;i++){const t=(i-start)/seam,t2=t*t,t3=t2*t;frames[i]=a.map((v,k)=>(2*t3-3*t2+1)*v+(t3-2*t2+t)*va[k]+(-2*t3+3*t2)*b[k]+(t3-t2)*vb[k]);}
  let radius=0;for(const frame of frames){let cursor=0;for(let p=0;p<counts.length;p++){for(let j=0;j<counts[p];j++){const x=frame[cursor++],y=frame[cursor++];if(frame[coords+p]>2)radius=Math.max(radius,Math.hypot(x-114.2705,y-114.2705));}}}
  const scale=222/radius;
  const data=Buffer.alloc(N*words*2);let cursor=0;
  for(const frame of frames)for(let k=0;k<words;k++){
    const value=k<coords?(233+(frame[k]-114.2705)*scale)*64:Math.max(0,Math.min(255,frame[k]));
    if(!Number.isFinite(value)||value<-32768||value>32767)throw Error('Invalid vector coordinate '+name);
    data.writeInt16LE(Math.round(value),cursor);cursor+=2;
  }
  states.push({name,data});report.expressions[name]={...spec,scale,source_max_radius:radius};bot.destroy();console.log('Sampled',name);
}
const header=Buffer.alloc(32);header.write('GROKVP4\0',0,'ascii');[1,states.length,N,dt,words,counts.length].forEach((v,i)=>header.writeUInt32LE(v,8+i*4));
const names=Buffer.alloc(states.length*32);states.forEach((s,i)=>names.write(s.name,i*32,31,'ascii'));
const data=Buffer.concat([header,names,...states.map(s=>s.data)]);
fs.writeFileSync(path.join(out,'grok-vectors.bin'),data);report.bytes=data.length;
fs.writeFileSync(path.join(out,'vector-report.json'),JSON.stringify(report,null,2)+'\n');console.log('Vector bank',data.length,'bytes');
