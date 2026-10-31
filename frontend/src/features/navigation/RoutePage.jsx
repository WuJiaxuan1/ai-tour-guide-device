import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Plus,Trash2,Bus,MapPin,ChevronDown,ChevronUp} from 'lucide-react';
import {byId,mapLink} from '../../data';
import {readJourney,saveJourney} from '../../services/journey';
import {validatePersonalRoute} from '../../services/personal-routes';
import {visitKey} from '../../../../shared/routes.mjs';
import NavigationMap from '../../components/NavigationMap';
import StayPicker from '../../components/StayPicker';
import ImmersiveTag from '../../components/ImmersiveTag';
import {ActiveTour,DevicePairing,NavigationReminders} from './ServerTourControls';
import {isServerTourActive,legacyRoute,selectedStays} from '../../services/route-compat.mjs';
import {requestId} from '../../services/travel-api';
import './server-travel.css';
import PresetRoutePanel from './PresetRoutePanel';
import ShuttlePanel from './ShuttlePanel';
import './navigation.css';
import './presets.css';
import './workspace-layout.css';
const emptyFilters={gate:null,duration:null,intensity:null,companions:null};
const signature=(ids,entry,exit)=>JSON.stringify([[...new Set(ids)].sort(),entry,exit]);
export default function RoutePage({route,setRoute,onExplore,onDetail,onIllustration,visitor,onReport,onJournal,onHistory,onImmersive,serverTrip}){
 const [view,setView]=useState(()=>route.length?'custom':'presets');
 const [data,setData]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const [filters,setFilters]=useState(()=>({...emptyFilters,...readJourney('qixia.route-preferences-v06',{})}));
 const [step,setStep]=useState(0),[detailId,setDetailId]=useState(null),[pendingAdopt,setPendingAdopt]=useState(null);
 const [adopted,setAdopted]=useState(()=>readJourney('qixia.adopted-route',null));
 const [entry,setEntry]=useState(()=>readJourney('qixia.entry','gate')),[exit,setExit]=useState(()=>readJourney('qixia.exit','gate'));
 const [minutes,setMinutes]=useState(()=>readJourney('qixia.stay',{})),[picker,setPicker]=useState(null),[selected,setSelected]=useState(null),[expanded,setExpanded]=useState(false);
 const {trip,navigation,loading,connected}=serverTrip;
 const [busy,setBusy]=useState(false);
 const run=async fn=>{setBusy(true);serverTrip.setError('');try{await fn();}catch(e){serverTrip.setError(e.message);}finally{setBusy(false);}};
 const [planned,setPlanned]=useState(()=>readJourney('qixia.planned-route',null)),[planning,setPlanning]=useState(false),[planError,setPlanError]=useState('');
 const request=useRef(null),main=useRef(null),confirmDialog=useRef(null);
 const active=isServerTourActive(trip);
 const selectionSignature=signature(route,entry,exit);
 const currentPlan=planned?.signature===selectionSignature?planned.route:null;
 useEffect(()=>{const c=new AbortController();setError('');fetch('/api/routes/presets',{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();setData(await r.json());}).catch(()=>{if(!c.signal.aborted)setError('路线资料暂时无法加载，请重试。');});return()=>c.abort();},[attempt]);
 useEffect(()=>{saveJourney('qixia.route-preferences-v06',filters);},[filters]);
 useEffect(()=>{saveJourney('qixia.entry',entry);saveJourney('qixia.exit',exit);saveJourney('qixia.stay',minutes);},[entry,exit,minutes]);
 useEffect(()=>{request.current?.abort();setPlanning(false);setPlanError('');return()=>request.current?.abort();},[selectionSignature]);
 useEffect(()=>{if(pendingAdopt)confirmDialog.current?.showModal();},[pendingAdopt]);
 const chosen=data?.routes.find(r=>r.routeId===detailId);
 const adoptedPreset=data?.routes.find(r=>r.routeId===adopted?.routeId);
 const unchanged=adoptedPreset&&adopted.signature===selectionSignature;
 const point=id=>byId(id)||data?.nodes.find(n=>n.id===id)||{id,name:id};
 const draftStops=unchanged?adoptedPreset.stops:[entry,...route,exit].filter(Boolean).map((id,i)=>({...point(id),placeId:id,stopId:'selection-'+i}));
 const display=active?legacyRoute(trip.route):chosen||(view==='custom'?(currentPlan||{stops:draftStops}):null);
 const mapStops=useMemo(()=>(display?.stops||[]).map((s,i)=>({...s,id:visitKey(s),number:i+1})).filter(s=>s.location),[display]);
 const start=()=>run(async()=>{
  if(!currentPlan?.navigationReady||loading||active)return;
  const selection=unchanged?{presetId:adoptedPreset.routeId}:{stopIds:route,entryId:entry,exitId:exit};
  const body={selection,stay_minutes:selectedStays(currentPlan,minutes)},signature=JSON.stringify(body);
  let pending=readJourney('qixia.personal-trip-request',null);
  if(pending?.signature!==signature){pending={signature,client_event_id:requestId()};saveJourney('qixia.personal-trip-request',pending);}
  const c=new AbortController();request.current=c;const timer=setTimeout(()=>c.abort(),240000);
  try{const saved=await serverTrip.choosePersonal({...body,client_event_id:pending.client_event_id},c.signal);if(saved.status==='planned')await serverTrip.command('start');saveJourney('qixia.personal-trip-request',null);}
  finally{clearTimeout(timer);}
 });
 const adopt=(preset,merge=false)=>{
  const startId=data.gates.find(g=>g.id===preset.entryGateId)?.placeId||entry;
  const endId=data.gates.find(g=>g.id===preset.exitGateId)?.placeId||null;
  const ids=[...new Set((preset.completeness==='missing_exit'?preset.stops.slice(1):preset.stops.slice(1,-1)).map(s=>s.placeId||s.nodeId))];
  const selection=merge?[...new Set([...ids,...route])]:ids;
  const nextAdopted={routeId:preset.routeId,signature:signature(ids,startId,endId),selection:ids};
  setAdopted(nextAdopted);saveJourney('qixia.adopted-route',nextAdopted);setRoute(selection);setEntry(startId);setExit(endId);setPlanned(null);saveJourney('qixia.planned-route',null);setPendingAdopt(null);setDetailId(null);setView('custom');setSelected(null);
 };
 const requestAdopt=preset=>{if(route.length&&adopted?.routeId!==preset.routeId)setPendingAdopt(preset);else adopt(preset);};
 const plan=async()=>{
  request.current?.abort();const c=new AbortController();request.current=c;setPlanning(true);setPlanError('');
  const timeout=setTimeout(()=>c.abort('timeout'),240000);
  try{
   const payload=unchanged?{presetId:adoptedPreset.routeId}:{stopIds:route,entryId:entry,exitId:exit};
   const response=await fetch('/api/routes/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:c.signal});
   const result=await response.json();if(!response.ok)throw Error(result.error||'路线规划失败，请重试。');
   if(c.signal.aborted)return;
   const expected=unchanged?adoptedPreset.stops.map(s=>s.placeId):[entry,...[...new Set(route)].filter(id=>id!==entry&&id!==exit),exit];
   const value={signature:selectionSignature,route:validatePersonalRoute(result.route,expected,{fixedOrder:Boolean(unchanged)})};setPlanned(value);saveJourney('qixia.planned-route',value);setSelected(null);
   main.current?.closest('.main-route')?.scrollTo({top:0,behavior:'smooth'});
  }catch(e){if(request.current===c&&(!c.signal.aborted||c.signal.reason==='timeout'))setPlanError(c.signal.reason==='timeout'?'道路查询时间较长，请重试；已保留你的地点。':e.message||'道路暂时无法查询，请重试。');}
  finally{clearTimeout(timeout);if(request.current===c)setPlanning(false);}
 };
 const gates=(label,value,setValue)=><fieldset className="gate-pills"><legend>{label}</legend><div className="preference-pills">{data.gates.map(g=><button key={g.id} aria-pressed={value===g.placeId} disabled={!g.placeId} onClick={()=>setValue(g.placeId)}>{g.id==='west'?'西门':'南门'}</button>)}</div></fieldset>;
 return <section className="route-workspace" aria-label="我的栖霞路线">
 <header className="route-workspace-heading"><div><p>南京 · 栖霞山</p><h1>{active?'这一程，正在发生':'我的路线'}</h1></div><div className="route-report-links"><button onClick={onHistory}>历史行程</button><button onClick={onReport}>游览报告</button><button onClick={onJournal}>专属手账</button></div></header>
 <div className={'route-map-panel '+(expanded?'is-expanded':'')}><NavigationMap stops={mapStops} geometry={display?.geometry} selectedId={selected} onSelect={setSelected} onIllustration={onIllustration} userPosition={visitor.position} onLocate={visitor.locate}/><button className="route-map-toggle" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?<ChevronUp size={16}/>:<ChevronDown size={16}/>} {expanded?'收起地图':'展开地图'}</button></div>
 <nav className="route-view-tabs" aria-label="路线内容">{[['presets','官方推荐'],['custom','专属路线'],['shuttle','接驳车']].map(([key,label])=><button key={key} aria-pressed={view===key} disabled={Boolean(active)||busy||loading} onClick={()=>{setView(key);setDetailId(null);}}>{key==='shuttle'&&<Bus size={16}/>} {label}{key==='custom'&&route.length>0&&<small>{route.length}</small>}</button>)}</nav>
 <div className="route-main-panel" ref={main}>
 <fieldset disabled={busy||loading} style={{border:0,margin:0,padding:0,minWidth:0}}>
 {loading&&<p role="status">正在恢复行程…</p>}{serverTrip.error&&<p role="alert" className="route-data-note">{serverTrip.error}</p>}{active&&!connected&&<p role="status">正在恢复行程同步，最后状态仍保留。</p>}
 {visitor.error&&<p role="status" className="route-location-note">{visitor.error}</p>}
 {error&&<p role="alert" className="route-data-note">{error}<button onClick={()=>setAttempt(v=>v+1)}>重新加载</button></p>}
 {!data&&!error&&<p role="status">正在读取官方路线…</p>}
 {active?<ActiveTour serverTrip={serverTrip} busy={busy} run={run} onReport={onReport} onImmersive={onImmersive} onDetail={onDetail} setSelected={setSelected}/>
 :view==='shuttle'?<ShuttlePanel/>
 :chosen?<section className="preset-detail"><button className="route-back" onClick={()=>setDetailId(null)}><ArrowLeft size={16}/>返回推荐结果</button><h2>{chosen.name}</h2><ImmersiveTag route={chosen} onOpen={onImmersive}/><p>{chosen.description}</p><div className="preset-metrics"><span>官方约 <strong>{chosen.officialDurationMinutes/60}</strong> 小时</span><span><strong>{chosen.uniqueNodeCount}</strong> 处地点</span></div><ol className="preset-stop-list">{chosen.stops.map((s,i)=><li key={s.stopId} className={selected===s.stopId?'selected':''}><button aria-label={'查看第'+(i+1)+'站 '+s.name} onClick={()=>setSelected(s.stopId)}>{i+1}</button><div><strong>{s.name}</strong><ImmersiveTag placeId={s.placeId} onOpen={onImmersive}/><small>建议停留 {s.stayMinutes} 分钟{i>0&&chosen.stops.slice(0,i).some(p=>p.nodeId===s.nodeId)?' · 再次经过':''}</small>{byId(s.placeId)&&<button className="route-text-button" onClick={()=>onDetail(byId(s.placeId))}>查看地点介绍</button>}</div></li>)}</ol>{chosen.countDiscrepancy&&<p className="route-data-note">原资料标注 {chosen.officialNodeCount} 个景点，所列路线去重后为 {chosen.uniqueNodeCount} 个，数量待核对。</p>}{chosen.completeness==='missing_exit'&&<p className="route-data-note">这条路线在太虚亭结束，请在专属路线中选择离开入口后规划返程。</p>}<button className="route-primary" onClick={()=>requestAdopt(chosen)}>添加到专属路线</button></section>
 :view==='presets'&&data?<PresetRoutePanel data={data} filters={filters} onFilters={setFilters} onChoose={p=>setDetailId(p.routeId)} onAdopt={requestAdopt} step={step} onStep={setStep} onImmersive={onImmersive}/>
 :view==='custom'&&data?<section className="custom-route"><h2>{unchanged?adoptedPreset.name:'把想去的地点留在这一程'}</h2><ImmersiveTag route={{stops:draftStops}} onOpen={onImmersive}/><p>{unchanged?'已添加官方推荐，点击规划即可查看这条路线。':'在探索页增减地点，再按实际步行道路安排行程。'}</p><div className="personal-gates">{gates('从哪里进入',entry,setEntry)}{gates('从哪里离开',exit,setExit)}</div><div className="custom-stop-list">{route.map(id=>{const p=point(id);return <article key={id}><button onClick={()=>byId(id)?onDetail(p):setSelected(draftStops.find(s=>s.placeId===id)?.stopId)}><MapPin size={16}/>{p.name}</button><button className="stay-trigger" onClick={()=>setPicker(p)}>停留 {minutes[id]??20} 分钟</button><button aria-label={'移除'+p.name} onClick={()=>setRoute(old=>old.filter(x=>x!==id))}><Trash2 size={17}/></button></article>;})}</div><button className="route-add" onClick={onExplore}><Plus size={16}/>选择景点或设施</button>{!route.length&&<p className="route-data-note">先选择景点，或从官方推荐添加一条路线。</p>}<div className="route-actions"><button className="route-primary" disabled={!route.length||!entry||!exit||planning} onClick={plan}>{planning?'正在查询步行道路…':'智能规划最优路线'}</button>{planning&&<button onClick={()=>{request.current?.abort();setPlanning(false);}}>取消规划</button>}</div>{planning&&<p role="status" className="route-data-note">正在核对各段道路，首次规划可能需要一些时间。</p>}{planError&&<p className="route-inline-error" role="alert">{planError}</p>}{currentPlan&&<><p className="route-plan-summary">{(currentPlan.distanceMeters/1000).toFixed(2)} 公里 · 步行约 {Math.ceil(currentPlan.walkingSeconds/60)} 分钟</p><p className="route-data-note">{currentPlan.optimization.mode==='preset'?'沿用官方路线顺序，已加载沿道路的路径。':currentPlan.optimization.mode==='exact'?'已按所选地点之间的步行道路距离计算最短顺序。':'地点较多，已按实际道路距离优化顺序；不保证全局最短。'}步行时间不含停留。</p><ol className="route-flow">{currentPlan.stops.map(s=><li key={s.stopId}>{s.name}</li>)}</ol><button className="route-primary" disabled={busy||loading} onClick={start}>{busy?'正在同步行程…':'开始游览'}</button></>}<button className="route-text-button" onClick={()=>setView('presets')}>查看官方推荐路线</button></section>:null}
 {trip?.status==='planned'&&!active&&<section className="route-data-note"><p>已保存的行程：{trip.route.name}</p><button disabled={busy||loading||!trip.route.navigation_ready} onClick={()=>run(()=>serverTrip.command('start'))}>继续已保存行程</button></section>}
 <DevicePairing key={trip?.id||'none'} trip={trip} busy={busy} run={run}/>
 <NavigationReminders navigation={navigation} onImmersive={onImmersive}/>

 </fieldset></div>
 {pendingAdopt&&<dialog ref={confirmDialog} className="adopt-dialog" onCancel={()=>setPendingAdopt(null)} aria-label="添加官方路线"><h2>专属路线中已有地点</h2><p>如何加入“{pendingAdopt.name}”？</p><button className="route-primary" onClick={()=>adopt(pendingAdopt)}>使用这条路线替换</button><button onClick={()=>adopt(pendingAdopt,true)}>保留已选地点并合并</button><button onClick={()=>setPendingAdopt(null)}>取消</button></dialog>}
 {picker&&<StayPicker place={picker} value={minutes[picker.id]??20} onClose={()=>setPicker(null)} onSave={v=>setMinutes(m=>({...m,[picker.id]:v}))}/>}

 </section>;
}
