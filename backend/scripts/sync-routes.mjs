import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const source='docs/requirements/official-routes/';
const read=p=>readFileSync(resolve(root,p),'utf8').replace(/^\uFEFF/,'');
const md=read(source+'official-shuttle-and-routes-v1.0.md');
const csv=read(source+'official-route-filter-matrix-v1.0.csv');
const catalog=[...JSON.parse(read('frontend/src/content/places.json')),...JSON.parse(read('frontend/src/content/facilities.json'))];
const aliases={'彩虹明镜':'mirror-lake','栖霞古寺':'temple','西门游客中心':'facility-b00190z2ds','小营盘':'camp','栖霞古镇':'old-street'};
// Similar spellings are deliberately NOT aliases: 青锋涧/青锋剑石, 乾隆御花园/行宫.
const mapping=new Map();
function node(name,kind='place'){
 const key=kind+':'+name;
 if(!mapping.has(key)){
  const p=catalog.find(p=>p.id===aliases[name])||catalog.find(p=>p.name===name);
  const id='official-'+createHash('sha256').update(key).digest('hex').slice(0,12);
  mapping.set(key,{nodeId:id,name,kind,placeId:kind==='place'?p?.id||null:null,nearPlaceId:kind==='shuttle_stop'?p?.id||null:null,location:kind==='place'?p?.location||null:null,status:kind==='place'&&p?'mapped':'unresolved'});
 }
 return mapping.get(key);
}
const routes=[...md.matchAll(/### (R\d{2}) (.+)\r?\n([\s\S]*?)(?=\r?\n### |\r?\n## 五)/g)].map(([,routeId,name,body])=>{
 const field=label=>body.match(new RegExp('- '+label+'：([^\\r\\n]+)'))?.[1];
 const stops=field('路线序列').split(' → ').map((raw,i)=>{
  const m=raw.match(/^(.+?)（(\d+) 分钟(?:，(.+))?）$/);if(!m)throw Error('Unparseable stop: '+raw);
  const n=node(m[1]);const facility=m[3]?node(m[3],'facility'):null;
  return {stopId:routeId+'-'+String(i+1).padStart(2,'0'),nodeId:n.nodeId,name:n.name,placeId:n.placeId,location:n.location,stayMinutes:Number(m[2]),facility:facility?{nodeId:facility.nodeId,name:facility.name,placeId:facility.placeId}:null};
 });
 const officialDurationMinutes=Number(field('官方总时长').match(/[\d.]+/)[0])*60;
 const uniqueNodeCount=new Set(stops.map(s=>s.nodeId)).size;
 const officialNodeCount=Number(field('去重景点数'));
 return {routeId,revision:1,name,description:field('官方描述'),entryGateId:name.startsWith('西门')?'west':'south',exitGateId:routeId==='R06'?null:name.startsWith('西门')?'west':'south',officialDurationMinutes,officialNodeCount,uniqueNodeCount,countDiscrepancy:uniqueNodeCount!==officialNodeCount,stops,source:{provider:'official',date:'2026-10-30'},completeness:routeId==='R06'?'missing_exit':'listed',distanceMeters:null,walkingSeconds:null,totalMinutes:null,geometry:null,legs:[],navigationReady:false};
});
if(routes.length!==8)throw Error('Expected eight source routes');
const names=new Map(routes.map(r=>[r.name,r.routeId]));
const values={gate:{'西门（牌坊）':'west','南门（蝴蝶谷）':'south'},duration:{'半日':'half','全天':'full'},intensity:{'轻松休闲':'easy','正常游览':'normal','能量无限':'energetic'},companions:{'60岁以上老人':'senior','3-12岁儿童':'child','未选择':'none'}};
const [header,...rows]=csv.trim().split(/\r?\n/).map(l=>l.split(','));
if(header.join(',')!=='gate,duration,intensity,companions,result_status,recommended_routes')throw Error('Unexpected CSV schema');
const rules=rows.map((row,i)=>{
 if(row.length!==6)throw Error('Unexpected CSV columns on row '+(i+2));
 const rule=Object.fromEntries(Object.keys(values).map((k,j)=>[k,values[k][row[j]]]));
 if(Object.values(rule).some(v=>!v))throw Error('Unknown CSV selection');
 const routeIds=row[5]?row[5].split('|').map(n=>{if(!names.has(n))throw Error('Unknown route '+n);return names.get(n);}):[];
 if(!['matched','no_match'].includes(row[4])||(row[4]==='matched')!==Boolean(routeIds.length))throw Error('Invalid CSV result');
 return {...rule,status:row[4],routeIds};
});
const options=Object.fromEntries(Object.entries(values).map(([key,vals])=>[key,Object.entries(vals).map(([label,value])=>({label,value}))]));
const shuttles=[...md.matchAll(/^\| (虎山线|龙山线|南山景区) \| (上行|下行) \| (.+) \|$/gm)].map(([,name,direction,stations],i)=>({lineId:'internal-'+(i+1),scope:'internal',name,direction,hours:'08:30–16:30',fareYuan:20,fareUnit:'单程 / 人',phone:'025-83784726',stops:stations.split(' → ').map(s=>node(s,'shuttle_stop'))}));
for(const [i,match]of [...md.matchAll(/#### (.+)\r?\n\r?\n- 运营时间：([^\r\n]+)\r?\n- 站点：([^\r\n]+)/g)].entries()){
 const [,name,hours,stations]=match;shuttles.push({lineId:'external-'+(i+1),scope:'external',name,direction:'单程',hours,fareYuan:2,fareUnit:'单程 / 人',phone:'025-83784726',stops:stations.split(' → ').map(s=>node(s,'shuttle_stop'))});
}
if(shuttles.length!==8)throw Error('Expected eight directional shuttle lines');
const write=(p,data)=>{const target=resolve(root,p);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,JSON.stringify(data,null,2)+'\n');};
write('backend/data/routes/preset-routes.v1.json',{version:'official-v1',routes});
write('backend/data/routes/route-filter-matrix.v1.json',{version:'official-v1',options,rules});
write('backend/data/routes/route-node-mapping.v1.json',{version:'official-v1',nodes:[...mapping.values()]});
write('backend/data/transport/shuttle-lines.v1.json',{version:'official-v1',sourceDate:'2026-10-30',lines:shuttles});
console.log(JSON.stringify({routes:routes.length,rules:rules.length,shuttles:shuttles.length,unresolved:[...mapping.values()].filter(n=>n.status==='unresolved').length}));
