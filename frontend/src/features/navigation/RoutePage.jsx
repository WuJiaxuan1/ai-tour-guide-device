import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUp,ArrowDown,ChevronDown,ChevronUp,Footprints,Plus,X,LoaderCircle,Sparkles,RotateCcw,MapPin,Play,Check,Flag,Clock} from 'lucide-react';
import {byId,mapLink} from '../../data';
import {planWalkingRoute,validateRoute} from '../../services/navigation';
import {timeline,readJourney,saveJourney} from '../../services/journey';
import {formatDistance} from '../../services/distance';
import NavigationMap from '../../components/NavigationMap';
import PlaceImage from '../../components/PlaceImage';
import JourneyReport from './JourneyReport';
import './navigation.css';
const presets=[{name:'湖光与古桥',ids:['gate','mirror-lake','spring-bridge'],description:'西门出发，探访湖水与古桥。'},{name:'泉水与茶事',ids:['gate','tea','tea-house'],description:'从入园处走向泉水与茶文化点位。'},{name:'山中人文',ids:['gate','temple','palace'],description:'从栖霞寺建筑走向行宫遗址。'}];
export default function RoutePage({route,setRoute,onExplore,onDetail,onIllustration,visitor}){
 const signature=route.join('|');
 const [selected,setSelected]=useState(route[0]||null),[expanded,setExpanded]=useState(false),[planned,setPlanned]=useState(()=>{const p=readJourney('qixia.plan',null);try{return p?.stops.map(s=>s.id).join('|')===signature?validateRoute(p,route):null;}catch{return null;}}),[busy,setBusy]=useState(false),[mode,setMode]=useState('manual'),[error,setError]=useState(''),[round,setRound]=useState(()=>readJourney('qixia.plan',null)?.optimization?.returnToStart||false),[previous,setPrevious]=useState(null);
 const [minutes,setMinutes]=useState(()=>readJourney('qixia.stay',{})),[start,setStart]=useState(''),[trip,setTrip]=useState(()=>readJourney('qixia.trip',null)),[showReport,setShowReport]=useState(false),[showPresets,setShowPresets]=useState(false),[pendingPreset,setPendingPreset]=useState(null);
 const [replan,setReplan]=useState(false);
 const [entry,setEntry]=useState('gate'),[budget,setBudget]=useState('');
 const [pastTrips,setPastTrips]=useState(()=>readJourney('qixia.trip-history',[])),[reportTrip,setReportTrip]=useState(null);
 const controller=useRef(null),cards=useRef(new Map()),preserve=useRef(null),initial=useRef(true);const active=trip&&!trip.endedAt;
 useEffect(()=>{if(initial.current){initial.current=false;return;}if(preserve.current===signature){preserve.current=null;return;}controller.current?.abort();controller.current=null;setBusy(false);setPlanned(null);saveJourney('qixia.plan',null);setPrevious(null);setError('');setSelected(old=>route.includes(old)?old:route[0]||null);},[signature]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{saveJourney('qixia.stay',minutes);},[minutes]);
 useEffect(()=>{if(planned)saveJourney('qixia.plan',planned);},[planned]);
 const stops=useMemo(()=>route.map((id,i)=>({...byId(id),number:i+1})).filter(p=>p.id),[signature]);
 const select=useCallback(id=>{setSelected(id);const card=cards.current.get(id),parent=card?.parentElement;if(card&&parent)parent.scrollTo({top:card.offsetTop-parent.offsetTop,behavior:'smooth'});},[]);
 const updateTrip=t=>{if(!saveJourney('qixia.trip',t)){setError('浏览器存储空间不足，本次进度暂时只保留在当前页面。');}setTrip(t);};
 const plan=async optimize=>{if(busy||active)return;const c=new AbortController();controller.current=c;setBusy(true);setMode(optimize?'shortest':'manual');setError('');const timeout=setTimeout(()=>c.abort(),optimize?120000:45000);try{const result=await planWalkingRoute({stopIds:[...route],optimize,returnToStart:round,signal:c.signal});if(controller.current===c&&!c.signal.aborted){setPlanned(result);setReplan(false);setSelected(result.stops[0].id);if(optimize){const order=result.stops.map(p=>p.id);if(order.join('|')!==signature){setPrevious([...route]);preserve.current=order.join('|');setRoute(order);}}}}catch(e){if(controller.current===c)setError(e.name==='AbortError'?'规划已停止，可重新尝试。':e.message);}finally{clearTimeout(timeout);if(controller.current===c){setBusy(false);controller.current=null;}}};
 const move=(i,d)=>setRoute(old=>{const a=[...old];[a[i],a[i+d]]=[a[i+d],a[i]];return a;});
 const applyPreset=p=>{setRoute([...new Set([entry,...p.ids.filter(id=>id!=='gate')])].filter(id=>byId(id)?.navigationAvailable));setPlanned(null);setPendingPreset(null);setShowPresets(false);setExpanded(true);};
 const next=active?trip.route.stops.find(p=>!trip.visited[p.id]):null;
 const rows=timeline(stops,planned?.legs,minutes,start);
 return <section className={`navigation journey-navigation ${stops.length?'has-stops':''} ${expanded?'is-expanded':''}`} aria-label="我的栖霞路线">
 <NavigationMap stops={stops} geometry={planned?.geometry} selectedId={selected} onSelect={select} onIllustration={onIllustration} userPosition={visitor.position} onLocate={visitor.locate}/>
 <div className="navigation-heading"><span><Footprints size={14}/>探索栖霞山</span><button onClick={visitor.locate} aria-label="获取我的位置"><MapPin size={18}/></button></div>
 {visitor.error&&<p className="map-location-error" role="status">{visitor.error}</p>}
 <aside className="navigation-sheet" aria-label="路线地点"><button className="sheet-toggle" aria-label={expanded?'收起行程':'展开行程'} aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}><span/>{expanded?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button>
 <div className="navigation-sheet-title"><h1>{active?'正在游览':'我的行程'}</h1><button className="clear-route" disabled={active||busy} onClick={()=>setShowPresets(v=>!v)}>路线灵感</button></div>
 <div className="navigation-summary"><span>{stops.length} 个地点</span><span>{planned?`${formatDistance(planned.distanceMeters)} · 步行约 ${Math.ceil(planned.walkingSeconds/60)} 分钟`:'选择地点后规划步行路线'}</span></div>
 <div className="journey-scroll">
 {(showPresets||!stops.length)&&<div className="route-presets"><p>选择一条主题路线，再按你的想法调整。</p><label className="departure-time">出发入口<select value={entry} onChange={e=>setEntry(e.target.value)}>{['gate','facility-b0g0m1mptg'].map(byId).filter(Boolean).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{presets.map(p=><button key={p.name} disabled={active||busy} onClick={()=>stops.length?setPendingPreset(p):applyPreset(p)}><strong>{p.name}</strong><span>{p.description}</span></button>)}{pendingPreset&&<div className="preset-confirm"><p>用“{pendingPreset.name}”替换当前所选地点？</p><button onClick={()=>applyPreset(pendingPreset)}>替换地点</button><button onClick={()=>setPendingPreset(null)}>保留当前路线</button></div>}</div>}
 <details className="journey-settings"><summary>时间与停留设置</summary>{stops.length>0&&<label className="departure-time">可用时间<select value={budget} disabled={active} onChange={e=>setBudget(e.target.value)}><option value="">暂不设定</option>{[60,90,120,180,240].map(v=><option key={v} value={v}>{v} 分钟</option>)}</select></label>}
 {planned&&budget&&<p className="budget-summary">预计步行与停留共 {Math.ceil(planned.walkingSeconds/60)+rows.reduce((n,r)=>n+r.stay,0)} 分钟{Math.ceil(planned.walkingSeconds/60)+rows.reduce((n,r)=>n+r.stay,0)>Number(budget)?'，超出可用时间，可减少地点或停留时间。':'，在所选可用时间内。'}</p>}
 {planned&&<label className="departure-time">预计出发 <input type="time" value={start} disabled={active} onChange={e=>setStart(e.target.value)}/><span>仅用于预计到达时间</span></label>}
 </details>
 {pastTrips.length>0&&<label className="departure-time">游览记录<select aria-label="查看历史游览记录" value="" onChange={e=>{const item=pastTrips.find(t=>t.id===e.target.value);if(item){setReportTrip(item);setShowReport(true);}}}><option value="">选择一次游览</option>{pastTrips.map(t=><option key={t.id} value={t.id}>{new Date(t.startedAt).toLocaleString('zh-CN')}</option>)}</select></label>}
 {trip?.endedAt&&planned&&<button className="report-entry" onClick={()=>setShowReport(true)}>查看上次游览记录</button>}
 <div className="journey-timeline">{rows.map(({place:p,leg,arrival,stay},i)=><article className={`journey-stop ${selected===p.id?'is-selected':''}`} key={p.id} ref={n=>n?cards.current.set(p.id,n):cards.current.delete(p.id)}>
 {leg&&<p className="journey-leg"><Footprints size={12}/>{formatDistance(leg.distanceMeters)} · {Math.ceil(leg.walkingSeconds/60)} 分钟{leg.hasStairs?' · 含阶梯':''}{leg.hasSlope?' · 含坡道':''}</p>}
 <div className="journey-stop-row"><div className="journey-index"><span>{i+1}</span>{arrival&&<time>{arrival}</time>}</div><div className="journey-stop-content"><button className="journey-place-title" onClick={()=>select(p.id)}><h2>{p.name}</h2>{trip?.visited[p.id]&&<Check size={16}/>}</button><p>{p.intro}</p><button className="journey-photo" onClick={()=>onDetail(p)} aria-label={`查看${p.name}照片和详情`}><PlaceImage place={p}/></button><div className="journey-stop-actions"><label>停留 <select aria-label={`${p.name}停留时间`} value={stay} disabled={active} onChange={e=>setMinutes(m=>({...m,[p.id]:Number(e.target.value)}))}>{[0,10,20,30,45,60,90,120,180].map(v=><option value={v} key={v}>{v} 分钟</option>)}</select></label><span/>{i>0&&<button disabled={active||busy} aria-label={`上移${p.name}`} onClick={()=>move(i,-1)}><ArrowUp size={15}/></button>}{i<stops.length-1&&<button disabled={active||busy} aria-label={`下移${p.name}`} onClick={()=>move(i,1)}><ArrowDown size={15}/></button>}<button disabled={active||busy} aria-label={`移除${p.name}`} onClick={()=>setRoute(v=>v.filter(id=>id!==p.id))}><X size={15}/></button></div></div></div></article>)}</div>
 {planned?.optimization?.returnToStart&&planned.legs?.length===stops.length&&<p className="journey-return"><RotateCcw size={13}/>返回 {stops[0]?.name} · {formatDistance(planned.legs.at(-1).distanceMeters)} · {Math.ceil(planned.legs.at(-1).walkingSeconds/60)} 分钟</p>}
 {!active&&<button className="journey-add" disabled={busy} onClick={onExplore}><Plus size={18}/>添加地点</button>}
 {planned&&<p className="journey-note">步行时间来自地图，预计到达时间加上所选停留时间。通行以现场指引为准。</p>}
 </div>
 <div className="navigation-footer">{error&&<p className="navigation-error" role="alert">{error}</p>}
 {active?<div className="tour-controls">{next?<><p>下一站：{next.name}</p><a className="plan-route" href={mapLink(next)} target="_blank" rel="noreferrer">导航到这一站</a><button onClick={()=>updateTrip({...trip,visited:{...trip.visited,[next.id]:Date.now()}})}><Check size={16}/>我已到达</button></>:<p>已确认全部地点。</p>}<button onClick={()=>{updateTrip({...trip,endedAt:Date.now()});setShowReport(true);}}><Flag size={15}/>结束游览并查看记录</button></div>:<>
 {stops.length>0&&(!planned||replan)&&<><div className="route-options"><label><input type="checkbox" checked={round} disabled={busy} onChange={e=>{setRound(e.target.checked);setPlanned(null);saveJourney('qixia.plan',null);}}/>返回起点</label><span>首站固定</span>{previous&&<button disabled={busy} onClick={()=>{setRoute(previous);setPrevious(null);}}>恢复原顺序</button>}</div><div className="route-plan-actions"><button className="plan-route manual-plan" disabled={stops.length<2||busy} onClick={()=>plan(false)}>按当前顺序规划</button><button className="plan-route" disabled={stops.length<2||busy} onClick={()=>plan(true)}>{busy?<LoaderCircle size={15} className="spin"/>:<Sparkles size={15}/>}智能规划最短路线</button></div></>}
 {busy&&<div className="route-planning-status" role="status">正在计算真实步行道路…<button onClick={()=>controller.current?.abort()}>取消</button></div>}
 {planned&&!busy&&!replan&&<div className="journey-ready-actions"><button className="journey-start" onClick={()=>{if(trip?.endedAt){const history=[trip,...pastTrips.filter(v=>v.id!==trip.id)].slice(0,20);saveJourney('qixia.trip-history',history);setPastTrips(history);}updateTrip({id:globalThis.crypto?.randomUUID?.()||String(Date.now()),route:planned,startedAt:Date.now(),endedAt:null,visited:{}});setExpanded(false);}}><Play size={14}/>开始游览</button><button className="journey-replan" onClick={()=>setReplan(true)}>调整规划</button></div>}
 {trip?.endedAt&&!planned&&<button className="report-entry" onClick={()=>setShowReport(true)}>查看上次游览记录</button>}</>}
 </div></aside>{showReport&&(reportTrip||trip)&&<JourneyReport trip={reportTrip||trip} onClose={()=>{setShowReport(false);setReportTrip(null);}}/>}</section>;
}
