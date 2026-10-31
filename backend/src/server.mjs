import http from 'node:http';
import {createPresetService} from './presets.mjs';
import {createConversationService} from './conversation.mjs';
import {serveStatic} from './static.mjs';
import {readFileSync,existsSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {readConfig} from './config.mjs';
import {ServiceError,amapRequest,mergeLegs} from './amap.mjs';
import {createKnowledgeService} from './knowledge.mjs';
import {shortestOrder} from './route-optimizer.mjs';
import {createRoadPlanner} from './road-planner.mjs';
import {createTravelApi} from './travel/api.mjs';
import {createReverseGeocoder} from './travel/location-address.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const catalog=JSON.parse(readFileSync(resolve(root,'frontend/src/content/places.json'),'utf8'));
const facilitiesPath=resolve(root,'frontend/src/content/facilities.json');
const facilities=existsSync(facilitiesPath)?JSON.parse(readFileSync(facilitiesPath,'utf8')):[];
const nodesPath=resolve(root,'backend/data/navigation-nodes.json');
const navigationNodes=existsSync(nodesPath)?JSON.parse(readFileSync(nodesPath,'utf8')).nodes:{};
const known=new Map([...catalog,...facilities].map(p=>[p.id,p])),poiCache=new Map(),routeCache=new Map(),legCache=new Map();let weatherCache,lastRouteRequest=0;
const roadCachePath=resolve(root,'.local-work/road-cache.json');
try{const saved=JSON.parse(readFileSync(roadCachePath,'utf8'));for(const[k,v]of Object.entries(saved)){if(v&&Date.now()-v.at<600000&&v.path)legCache.set(k,v);}}catch{}
function saveRoadCache(){try{mkdirSync(dirname(roadCachePath),{recursive:true});const entries=[...legCache].filter(([,v])=>Date.now()-v.at<600000&&v.path).slice(-256);writeFileSync(roadCachePath+'.tmp',JSON.stringify(Object.fromEntries(entries)));renameSync(roadCachePath+'.tmp',roadCachePath);}catch{}}
let routeQueue=Promise.resolve();
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){const chunks=[];let size=0;for await(const part of req){size+=part.length;if(size>131072)throw new ServiceError('请求内容过大。',413);chunks.push(part);}try{const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();return parsed;}catch{throw new ServiceError('请求格式不正确。',400);}}
const normalized=s=>s.replace(/[\s·（）()、—\-]/g,'');
function location(text){const p=String(text).split(',').map(Number);return p.length===2&&p.every(Number.isFinite)&&p[0]>118.93&&p[0]<119.01&&p[1]>32.12&&p[1]<32.19?p:null;}
async function resolvePlace(id,key,signal){
 if(!known.has(id))throw new ServiceError('有地点无法识别，请重新选择。',400);
 if(poiCache.has(id))return poiCache.get(id);
 const item=navigationNodes[id];
 if(item&&location(item.location.join(','))){const place={id,name:known.get(id).name,location:item.location,positionSource:item.positionSource};poiCache.set(id,place);return place;}
 throw new ServiceError(`${known.get(id).name}暂未找到对应的景区导航点，可先选择其他地点。`,422);
}
async function walkingLeg(from,to,key,signal){
 const signature=from.location.join(',')+'>'+to.location.join(',');const cached=legCache.get(signature);if(cached&&Date.now()-cached.at<600000)return cached.path;
 if(from.location.every((v,i)=>v===to.location[i]))return{distance:'0',duration:'0',steps:[]};
 const task=routeQueue.then(async()=>{if(signal.aborted)throw new ServiceError('规划已取消。',499);const delay=Math.max(0,700-(Date.now()-lastRouteRequest));if(delay)await new Promise(r=>setTimeout(r,delay));lastRouteRequest=Date.now();const data=await amapRequest('/v3/direction/walking',{origin:from.location.join(','),destination:to.location.join(',')},key,{signal});const path=data.route?.paths?.[0]||null;if(path){legCache.set(signature,{at:Date.now(),path});saveRoadCache();}return path;});routeQueue=task.catch(()=>{});return task;
}
async function weather(key,signal){
  if(weatherCache&&Date.now()-weatherCache.at<20*60000)return weatherCache.data;
  const [live,forecast]=await Promise.all([amapRequest('/v3/weather/weatherInfo',{city:'320113',extensions:'base'},key,{signal}),amapRequest('/v3/weather/weatherInfo',{city:'320113',extensions:'all'},key,{signal})]);
  const l=live.lives?.[0],f=forecast.forecasts?.[0];
  if(!l||!f?.casts?.length)throw new ServiceError('天气数据暂不可用。');
  const data={area:'栖霞区',source:'amap',reportTime:l.reporttime,forecastReportTime:f.reporttime,live:{weather:l.weather,temperature:Number(l.temperature),wind:l.winddirection},forecasts:f.casts.map(v=>({date:v.date,dayWeather:v.dayweather,nightWeather:v.nightweather,dayTemperature:Number(v.daytemp),nightTemperature:Number(v.nighttemp)}))};
  if(!Number.isFinite(data.live.temperature)||data.forecasts.some(v=>!Number.isFinite(v.dayTemperature)||!Number.isFinite(v.nightTemperature)))throw new ServiceError('天气数据格式不完整。');
  weatherCache={at:Date.now(),data};return data;
}
const knowledge=createKnowledgeService(root,[...catalog,...facilities]);
const presets=createPresetService(root,[...catalog,...facilities]);
const planRoads=createRoadPlanner({catalog:[...catalog,...facilities],data:presets.data,walkingLeg});
const converse=createConversationService(knowledge,presets,[...catalog,...facilities]);
const travel=createTravelApi({root,presets,knowledge,converse,catalog:[...catalog,...facilities],
 planRoads:(selection,{signal})=>planRoads(selection,{key:readConfig(root).serverKey,signal}),
 reverseGeocode:createReverseGeocoder({key:()=>readConfig(root).serverKey}),
 convertLocation:async location=>{const d=await amapRequest('/v3/assistant/coordinate/convert',{locations:location.map(n=>n.toFixed(6)).join(','),coordsys:'gps'},readConfig(root).serverKey,{});return String(d.locations).split(',').map(Number);},
 walkingLeg:async (from,to)=>{const p=await walkingLeg({location:from},{location:to},readConfig(root).serverKey,AbortSignal.timeout(12000));return p?{distance_m:Number(p.distance),walk_seconds:Number(p.duration)}:null;}
});
const rates=new Map();
const server=http.createServer(async(req,res)=>{
  const c=new AbortController();res.on('close',()=>{if(!res.writableEnded)c.abort();});
  try{
    const url=new URL(req.url,'http://localhost'),config=readConfig(root);
    if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/_AMapService/')){
      const client=req.socket.remoteAddress,now=Date.now();let rate=rates.get(client);if(!rate||now-rate.at>60000){rate={at:now,n:0};rates.set(client,rate);}if(++rate.n>180)throw new ServiceError('请求较多，请稍后再试。',429);
    }
    if(await travel.handle(req,res,url))return;
    if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true,mapConfigured:Boolean(config.webKey&&config.jscode),servicesConfigured:Boolean(config.serverKey)});
    if(req.method==='GET'&&url.pathname==='/api/capabilities')return json(res,200,{knowledge:{mode:'bounded-retrieval',multiTurn:'rules',version:knowledge.version,places:knowledge.catalog.length},textModel:{provider:'xiaozhi',connected:false},routes:{mode:'official-presets',count:presets.data.routes.length,verifiedRoadEdges:presets.data.matrix.edges.length,ready:presets.data.routes.filter(r=>r.navigationReady).map(r=>r.routeId)},watch:{requiresAndroid:true,routeSync:false,acknowledgement:null}});
    if(req.method==='GET'&&url.pathname==='/api/config')return json(res,200,{map:{webKey:config.webKey,serviceHost:'/_AMapService',configured:Boolean(config.webKey&&config.jscode)}});
    if(url.pathname.startsWith('/_AMapService/')){
      if(!config.webKey||!config.jscode)throw new ServiceError('地图服务尚未配置。',503);
      if(req.method!=='GET')throw new ServiceError('请求方式不支持。',405);
      const path=url.pathname.slice('/_AMapService'.length);if(!/^\/v[345]\/[A-Za-z0-9/_-]+$/.test(path))throw new ServiceError('请求路径不支持。',400);
      const upstream=new URL(path,path.startsWith('/v4/map/styles')?'https://webapi.amap.com':'https://restapi.amap.com');upstream.search=url.search;upstream.searchParams.set('key',config.webKey);upstream.searchParams.set('jscode',config.jscode);
      let response;try{response=await fetch(upstream,{signal:AbortSignal.any([c.signal,AbortSignal.timeout(15000)])});}catch{throw new ServiceError('地图服务暂时无法连接。',504);}
      res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/json','Cache-Control':'no-store'});return res.end(Buffer.from(await response.arrayBuffer()));
    }
    if(req.method==='GET'&&url.pathname==='/api/knowledge/catalog')return json(res,200,{version:knowledge.version,pois:knowledge.catalog});
    if(req.method==='GET'&&url.pathname.startsWith('/api/knowledge/pois/')){const poi=knowledge.publicPoi(decodeURIComponent(url.pathname.slice('/api/knowledge/pois/'.length)));return json(res,poi?200:404,poi||{error:'没有找到对应景点讲解。'});}
    if(req.method==='POST'&&url.pathname==='/api/knowledge/chat')return json(res,200,await converse(await body(req),{signal:c.signal}));
    if(req.method==='GET'&&url.pathname==='/api/routes/presets')return json(res,200,presets.data);
    if(req.method==='POST'&&url.pathname==='/api/routes/match')return json(res,200,presets.match(await body(req)));
    if(req.method==='POST'&&url.pathname==='/api/routes/custom')return json(res,200,presets.custom(await body(req)));
    if(req.method==='POST'&&url.pathname==='/api/routes/plan')return json(res,200,{route:await planRoads(await body(req),{key:config.serverKey,signal:c.signal})});
    if(req.method==='GET'&&url.pathname==='/api/transport/shuttles')return json(res,200,presets.shuttles);
    if(req.method==='GET'&&url.pathname==='/api/devices/capabilities')return json(res,200,{routeSync:false,requiresAndroid:true,positionSource:'android-phone',acknowledgement:null});
    if(req.method==='POST'&&url.pathname==='/api/recommendations'){const d=await body(req);return json(res,200,knowledge.recommend(d));}
    if(req.method==='GET'&&url.pathname==='/api/facilities/nearby'){const loc=url.searchParams.get('location');return json(res,200,{coordinateSystem:'GCJ02',places:knowledge.facilitiesNearby({location:loc?.split(',').map(Number),type:url.searchParams.get('type')||''})});}
    if(req.method==='POST'&&url.pathname==='/api/location/convert'){
      const d=await body(req),p=d.location;if(d.coordinateSystem!=='WGS84'||!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90)throw new ServiceError('手机位置格式不正确。',400);
      const converted=await amapRequest('/v3/assistant/coordinate/convert',{locations:p.map(x=>x.toFixed(6)).join(','),coordsys:'gps'},config.serverKey,{signal:c.signal});const out=String(converted.locations).split(',').map(Number);
      if(out.length!==2||!out.every(Number.isFinite))throw new ServiceError('位置转换暂时不可用，请重试。');return json(res,200,{coordinateSystem:'GCJ02',location:out});
    }
    if(req.method==='GET'&&url.pathname==='/api/weather')return json(res,200,await weather(config.serverKey,c.signal));
    if(req.method==='GET'&&url.pathname==='/api/navigation/places'){
      const ids=(url.searchParams.get('ids')||'').split(',').filter(Boolean).slice(0,12),places=[],unresolved=[],issues=[];
      for(const id of ids){try{places.push(await resolvePlace(id,config.serverKey,c.signal));}catch(e){unresolved.push(id);issues.push({id,message:e.message,status:e.status||500});}}
      return json(res,200,{coordinateSystem:'GCJ02',coordinateOrder:'lng,lat',places,unresolved,issues});
    }
    if(req.method==='POST'&&url.pathname==='/api/navigation/routes'){
      const d=await body(req),ids=d.stopIds,optimize=d.optimize===true,returnToStart=d.returnToStart===true;
      if(d.schemaVersion!=='1.0'||d.travelMode!=='walking'||d.coordinateSystem!=='GCJ02'||d.coordinateOrder!=='lng,lat'||!Array.isArray(ids)||ids.length<2||ids.length>8||new Set(ids).size!==ids.length||ids.some(id=>!known.has(id)))throw new ServiceError('请选择2至8个不同地点。',400);
      const signature=ids.join('|')+'|'+optimize+'|'+returnToStart,cached=routeCache.get(signature);if(cached&&Date.now()-cached.at<600000)return json(res,200,{route:cached.route});
      const stops=[];for(const id of ids)stops.push(await resolvePlace(id,config.serverKey,c.signal));
      let order=stops.map((_,i)=>i),baseline=null;const legs=new Map();
      const get=async(i,j)=>{const k=i+'>'+j;if(!legs.has(k))legs.set(k,await walkingLeg(stops[i],stops[j],config.serverKey,c.signal));return legs.get(k);};
      if(optimize){const n=stops.length,matrix=Array.from({length:n},()=>Array(n).fill(Infinity));for(let i=0;i<n;i++)for(let j=0;j<n;j++){if(i===j){matrix[i][j]=0;continue;}const p=await get(i,j);if(p)matrix[i][j]=Number(p.distance);}let b=0;for(let i=1;i<n;i++)b+=matrix[i-1][i];if(returnToStart)b+=matrix[n-1][0];baseline=Number.isFinite(b)?b:null;order=shortestOrder(matrix,{returnToStart}).order;}
      const paths=[];for(let i=1;i<order.length;i++){const p=await get(order[i-1],order[i]);if(!p)throw new ServiceError('所选地点之间暂未找到步行道路，请调整地点。',422);paths.push(p);}if(returnToStart){const p=await get(order.at(-1),order[0]);if(!p)throw new ServiceError('暂未找到返回起点的步行道路。',422);paths.push(p);}
      const route=mergeLegs(paths,order.map(i=>stops[i]),randomUUID());route.optimization={mode:optimize?'shortest':'manual',returnToStart,baselineDistanceMeters:baseline,stopOrder:route.stops.map(p=>p.id)};routeCache.set(signature,{at:Date.now(),route});return json(res,200,{route});
    }
    if(url.pathname.startsWith('/api/'))return json(res,404,{error:'接口尚未接通。'});
    if(req.method!=='GET'&&req.method!=='HEAD')throw new ServiceError('请求方式不支持。',405);
    return serveStatic(root,req,res,url);
  }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e instanceof ServiceError?e.message:'服务暂时无法完成请求，请稍后重试。'});else res.end();}
});
server.listen(Number(process.env.PORT||8787),'127.0.0.1',()=>console.log(`Qixia navigation service ready on 127.0.0.1:${server.address().port} (credentials are never logged).`));
