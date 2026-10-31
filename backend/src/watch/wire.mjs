import {randomBytes} from 'node:crypto';
export const palette=[0xff4fb4,0x008cff,0xffb547,0xffffff,0x888888];
export const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<85;
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^(0xedb88320&-(crc&1));}return (~crc)>>>0;}
export const newSession=()=>randomBytes(16).toString('hex');
function check(ok,message){if(!ok)throw Error(message);}
export function simplify(raw){
 check(Array.isArray(raw)&&raw.length>=2&&raw.length<=100000&&raw.every(validPoint),'Invalid route geometry');
 const p=raw.filter((v,i)=>!i||v.some((n,j)=>n!==raw[i-1][j]));check(p.length>=2,'Route has no segments');
 const scale=111320*Math.cos(p[0][1]*Math.PI/180),xy=p.map(v=>[(v[0]-p[0][0])*scale,(v[1]-p[0][1])*111320]);
 for(const tolerance of [1,2,4,8]){
  const keep=new Set([0,p.length-1]),stack=[[0,p.length-1]];
  while(stack.length){const [a,z]=stack.pop(),[ax,ay]=xy[a],dx=xy[z][0]-ax,dy=xy[z][1]-ay,len=dx*dx+dy*dy;let best=tolerance*tolerance,at=-1;
   for(let i=a+1;i<z;i++){const [x,y]=xy[i],t=len?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/len)):0,d=(x-ax-t*dx)**2+(y-ay-t*dy)**2;if(d>best){best=d;at=i;}}
   if(at>=0){keep.add(at);stack.push([a,at],[at,z]);}
  }
  const result=p.filter((_,i)=>keep.has(i));if(result.length<=2048)return result;
 }throw Error('Route exceeds device complexity limit');
}
export function encodeRoute(points,destination,session){
 check(points.length>=2&&points.length<=2048&&points.every(validPoint)&&validPoint(destination)&&/^[a-f0-9]{32}$/.test(session),'Invalid QRTE');
 const b=Buffer.alloc(80+16*points.length);b.write('QRTE');b.set([1,1,1,0],4);b.writeUInt32LE(1,8);b.writeUInt32LE(points.length,12);b.writeUInt32LE(b.length,16);Buffer.from(session,'hex').copy(b,24);
 palette.forEach((c,i)=>b.writeUInt32LE(c,40+i*4));b.writeUInt16LE(8,60);b.writeUInt16LE(1,62);
 [destination,...points].forEach((p,i)=>{b.writeDoubleLE(p[1],64+16*i);b.writeDoubleLE(p[0],72+16*i);});b.writeUInt32LE(crc32(b),20);return b;
}
export function encodeMap(rgb,bounds,session,route){
 check(rgb.length===480*480*3&&['north','west','south','east'].every(k=>Number.isFinite(bounds[k]))&&bounds.north<85&&bounds.south>-85&&bounds.west>=-180&&bounds.east<=180&&bounds.north>bounds.south&&bounds.east>bounds.west&&bounds.north-bounds.south<20&&bounds.east-bounds.west<20,'Invalid map');
 const b=Buffer.alloc(96+480*480*2);b.write('QMAP');b.set([4,4,1,0],4);b.writeUInt16LE(480,8);b.writeUInt16LE(480,10);b.writeUInt32LE(1,12);b.writeUInt32LE(b.length-96,16);Buffer.from(session,'hex').copy(b,24);
 ['north','west','south','east'].forEach((key,i)=>b.writeDoubleLE(bounds[key],48+i*8));b[80]=1;b.writeUInt32LE(crc32(route.subarray(64)),84);
 for(let i=0;i<480*480;i++)b.writeUInt16LE(((rgb[i*3]>>3)<<11)|((rgb[i*3+1]>>2)<<5)|(rgb[i*3+2]>>3),96+i*2);
 b.writeUInt32LE(crc32(b.subarray(96)),20);return b;
}
// Same bounded, monotonic prefix matching used by the Android test App.
export function advanceProgress(state,points,sample,now){
 const time=Date.parse(sample?.captured_at),accuracy=sample?.accuracy_m;
 if(!sample||now-time>15000||time>now||accuracy<=0||accuracy>25||time<=(state.handled??-1))return;
 state.handled=time;
 const origin=points[0],sx=111320*Math.cos(origin[1]*Math.PI/180),xy=p=>[(p[0]-origin[0])*sx,(p[1]-origin[1])*111320],target=xy(sample.location);
 const allowance=state.accepted==null?150:Math.max(30,Math.min(150,(time-state.accepted)/1000*3+accuracy*2+15));let walked=0,best=null;
 for(let i=1;i<points.length;i++){
  const a=xy(points[i-1]),b=xy(points[i]),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)continue;
  const t=Math.max(0,Math.min(1,((target[0]-a[0])*dx+(target[1]-a[1])*dy)/(len*len))),d=Math.hypot(target[0]-a[0]-t*dx,target[1]-a[1]-t*dy),along=walked+t*len;
  if(along>=Math.max(0,state.meters-30)&&along<=state.meters+allowance&&d<=Math.max(12,Math.min(40,accuracy*1.5))&&(!best||d<best.d-3||Math.abs(d-best.d)<=3&&Math.abs(along-state.meters)<Math.abs(best.along-state.meters)))best={d,along,cursor:i-1+t};
  walked+=len;
 }
 if(best){state.accepted=time;if(best.along>=state.meters+2||best.along>=walked-.001&&best.along>state.meters){state.meters=Math.max(state.meters,best.along);state.cursor=Math.max(state.cursor,best.cursor);}}
}
