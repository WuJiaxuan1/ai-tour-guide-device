import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readConfig} from '../src/config.mjs';
const root=process.cwd(),key=readConfig(root).serverKey,dir=path.join(root,'frontend/public/assets/amap');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,d)=>fs.writeFileSync(path.join(root,p),JSON.stringify(d,null,2)+'\n');
const raw=read('frontend/src/content/places.json'),facilities=read('frontend/src/content/facilities.json'),navigation=read('backend/data/navigation-nodes.json'),nodes=navigation.nodes;
const removed=raw.filter(p=>!nodes[p.id]||p.id==='panorama');
const places=raw.filter(p=>nodes[p.id]&&p.id!=='panorama').map(p=>({...p,location:nodes[p.id].location,address:nodes[p.id].address}));
const official=read('docs/requirements/official-miniapp-nodes-20261030.json');
const previousAuditPath=path.join(root,'docs/requirements/catalog-reconciliation-20261030.json');
const previousRemoved=fs.existsSync(previousAuditPath)?JSON.parse(fs.readFileSync(previousAuditPath,'utf8')).removed||[]:[];
const report={source:official.source,checkedAt:new Date().toISOString(),removed:[...new Map([...previousRemoved,...removed.map(({id,name})=>({id,name}))].map(p=>[p.id,p])).values()],matched:[],unresolved:[]};
let last=0;
async function query(api,params){await new Promise(r=>setTimeout(r,Math.max(0,750-(Date.now()-last))));last=Date.now();const u=new URL(api,'https://restapi.amap.com');for(const[k,v]of Object.entries({...params,key}))u.searchParams.set(k,v);const response=await fetch(u,{signal:AbortSignal.timeout(15000)});const d=await response.json();if(d.status!=='1')throw Error(d.info||'AMap request failed');return d;}
const point=p=>{const v=String(p.location).split(',').map(Number);return v.length===2&&v.every(Number.isFinite)&&v[0]>=118.950&&v[0]<=118.990&&v[1]>=32.145&&v[1]<=32.180?v:null};
const norm=s=>s.replace(/[\s·（）()、—\-]/g,'');
const photoManifestPath=path.join(root,'frontend/public/assets/amap-photo-sources.json');const photoManifest=fs.existsSync(photoManifestPath)?JSON.parse(fs.readFileSync(photoManifestPath,'utf8')):{};
async function photo(url,poiId){try{const u=new URL(url);if(u.protocol==='http:')u.protocol='https:';if(!['https:'].includes(u.protocol)||!/(^|\.)(autonavi\.com|amap\.com)$/.test(u.hostname))return null;const href=u.href;const cached=Object.entries(photoManifest).find(([local,src])=>src.url===href&&fs.existsSync(path.join(root,'frontend/public',local)));if(cached)return cached[0];const res=await fetch(href,{signal:AbortSignal.timeout(12000)});if(!res.ok||!res.headers.get('content-type')?.startsWith('image/'))return null;const chunks=[];let size=0;for await(const c of res.body){size+=c.length;if(size>8*1024*1024)throw Error('large photo');chunks.push(c);}const data=Buffer.concat(chunks),hash=crypto.createHash('sha256').update(data).digest('hex').slice(0,20),file=path.join(dir,hash+'.webp'),raw=path.join(dir,hash+'.download');if(!fs.existsSync(file)){fs.writeFileSync(raw,data);const code='from PIL import Image,ImageOps;import sys;im=ImageOps.exif_transpose(Image.open(sys.argv[1])).convert("RGB");im.thumbnail((1280,1280));im.save(sys.argv[2],"WEBP",quality=83,method=6)';const result=spawnSync(process.env.PYTHON_EXE||'python',[ '-c',code,raw,file],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});fs.unlinkSync(raw);if(result.status!==0)return null;}const local='/assets/amap/'+hash+'.webp';photoManifest[local]={provider:'amap',url:href,poiId,importedAt:new Date().toISOString()};return local;}catch{return null;}}

for(const record of official.records){
 try {
 // Generic bathroom labels cannot be uniquely matched using a place name.
 if(record.name==='卫生间'||(record.category==='厕所'&&!/卫生间|厕所/.test(record.name))){report.unresolved.push({...record,reason:'Generic label; need a distinct toilet POI'});continue;}
 const d=await query('/v5/place/text',{keywords:'栖霞山 '+record.name,region:'南京',city_limit:'true',page_size:25,show_fields:'photos,business,navi'});
 const hits=(d.pois||[]).filter(p=>point(p)&&!/(内部专用|小区)/.test(p.name+' '+p.address)&&/栖霞山|栖霞寺|栖霞街|栖霞古镇|红枫路|摄山/.test(p.name+' '+p.address)&&norm(p.name).includes(norm(record.name)));
 if(hits.length!==1){report.unresolved.push({...record,reason:hits.length?'More than one matching POI':'No unique local POI'});continue;}
 const p=hits[0],existing=[...places,...facilities].find(v=>v.amapPoiId===p.id);
 if(existing){existing.tags=[...new Set([...existing.tags,record.category])];report.matched.push({...record,id:existing.id,poiId:p.id,action:'reuse'});continue;}
 const id='facility-'+p.id.toLowerCase(),images=[];
 for(const entry of(p.photos||[]).slice(0,5)){if(entry.url){const asset=await photo(entry.url,p.id);if(asset&&!images.includes(asset))images.push(asset);}}
 const item={id,name:p.name,kind:'facility',category:record.category,facilityType:record.category,tags:[record.category],intro:p.address||record.address,story:`位置：${p.address||record.address}。请按地图步行指引前往，营业和服务情况以现场为准。`,images,image:images[0]||null,audio:null,amapPoiId:p.id,navigationAvailable:true,location:point(p),address:p.address||record.address};
 facilities.push(item);nodes[id]={id,name:item.name,poiId:p.id,poiName:p.name,location:item.location,address:item.address,positionSource:{provider:'amap-poi',poiId:p.id},photos:images};report.matched.push({...record,id,poiId:p.id,action:'added'});
 }catch(e){report.unresolved.push({...record,reason:String(e.message).slice(0,120)});}
 console.log('Checked',record.name);
}
// A destination has a single identity even if it has more than one category.
const byPoi=new Map(places.map(p=>[p.amapPoiId,p]));const clean=[];
for(const f of facilities){const existing=byPoi.get(f.amapPoiId);if(existing){existing.tags=[...new Set([...existing.tags,...f.tags])];continue;}byPoi.set(f.amapPoiId,f);clean.push(f);}
write('frontend/src/content/places.json',places);write('frontend/src/content/facilities.json',clean);
write('backend/data/navigation-nodes.json',{...navigation,updatedAt:new Date().toISOString(),nodes});
write('frontend/public/assets/amap-photo-sources.json',photoManifest);
write('docs/requirements/catalog-reconciliation-20261030.json',report);
console.log(JSON.stringify({scenic:places.length,facilities:clean.length,matched:report.matched.length,unresolved:report.unresolved.length}));
