import {useState} from 'react';
import {byId,mapLink} from '../../data';
import NavigationMap from '../../components/NavigationMap';
import ImmersiveTag from '../../components/ImmersiveTag';
import ServerPresetRoutePanel from './ServerPresetRoutePanel';
import ShuttlePanel from './ShuttlePanel';
import {readJourney,saveJourney} from '../../services/journey';
import {travelRequest,requestId} from '../../services/travel-api';
import './server-travel.css';
import './navigation.css';import './presets.css';import './workspace-layout.css';
export default function ServerRoutePage({onDetail,onIllustration,visitor,onReport,onJournal,onHistory,onImmersive,serverTrip}){
 const {trip,navigation,error,setError,loading,connected,choose,command}=serverTrip;
 const [view,setView]=useState('presets'),[detail,setDetail]=useState(null),[step,setStep]=useState(0),[expanded,setExpanded]=useState(false),[selected,setSelected]=useState(null),[busy,setBusy]=useState(false);
 const [binding,setBinding]=useState(null);
 const [pairCode,setPairCode]=useState('');
 const [filters,setFiltersState]=useState(()=>({gate:null,exitGate:null,duration:null,intensity:null,companions:[],...readJourney('qixia.route-preferences-v1',{})}));
 const setFilters=f=>{setFiltersState(f);saveJourney('qixia.route-preferences-v1',f);};
 const active=['active','paused'].includes(trip?.status),display=active?trip.route:detail||(view==='selected'?trip?.route:null);
 const run=async fn=>{setBusy(true);setError('');try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const adopt=(r,p)=>run(async()=>{await choose(r,p);setBinding(null);setView('selected');setDetail(null);});
 const finish=()=>run(async()=>{const completed=await command('complete');try{await travelRequest(`/trips/${completed.id}/jobs`,{method:'POST',body:{client_event_id:'completion-summary-'+completed.id,kind:'memory_summary'}});}catch(e){setError(e.message);}onReport();});
 const next=navigation?.next_stop;
 const list=r=><ol className="preset-stop-list">{r.stops.map((s,i)=><li key={s.stop_id}><button onClick={()=>setSelected(s.stop_id)}>{i+1}</button><div><strong>{s.name}</strong><ImmersiveTag placeId={s.attraction_id} onOpen={onImmersive}/><small>{s.status==='visited'?'已手动到访':s.status==='skipped'?'已跳过':`计划停留 ${s.planned_stay_seconds/60} 分钟`}</small>{byId(s.attraction_id)&&<button onClick={()=>onDetail(byId(s.attraction_id))}>查看讲解</button>}</div></li>)}</ol>;
 return <section className="route-workspace" aria-label="我的栖霞路线"><header className="route-workspace-heading"><div><p>南京 · 栖霞山</p><h1>{active?'这一程，正在发生':'我的路线'}</h1></div><div className="route-report-links"><button onClick={onHistory}>历史行程</button><button onClick={onReport}>游览报告</button><button onClick={onJournal}>专属手账</button></div></header>
 <div className={'route-map-panel '+(expanded?'is-expanded':'')}><NavigationMap stops={(display?.stops||[]).filter(s=>s.location).map((s,i)=>({...s,id:s.stop_id,number:i+1}))} geometry={display?.geometry} selectedId={selected} onSelect={setSelected} onIllustration={onIllustration} userPosition={visitor.position} onLocate={visitor.locate}/><button className="route-map-toggle" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'收起地图':'展开地图'}</button></div>
 <nav className="route-view-tabs" aria-label="路线内容">{[['presets','官方推荐'],['selected','已选路线'],['shuttle','接驳车']].map(([key,label])=><button key={key} aria-pressed={view===key} disabled={active||busy} onClick={()=>{setView(key);setDetail(null);}}>{label}</button>)}</nav>
 <div className="route-main-panel">{(error||visitor.error)&&<p role="alert" className="route-data-note">{error||visitor.error}</p>}{loading&&<p role="status">正在恢复行程…</p>}{active&&!connected&&<p role="status">正在恢复行程同步，最后状态仍保留。</p>}
 {active?<section className="active-route"><h2>{trip.route.name}</h2><ImmersiveTag route={trip.route} onOpen={onImmersive}/><p>{trip.status==='paused'?'游览已暂停':'行程记录已同步到服务器'}</p>{list(trip.route)}{navigation?.location.freshness==='fresh'&&<p className="route-data-note">当前位置参考：{navigation.current_place?.name?`已接近${navigation.current_place.name}`:navigation.location.address?.status==='resolved'?`${navigation.location.address.formatted_address}附近（高德）`:'已收到手机定位，附近地址暂不可用'}。定位不等于确认到访。</p>}{navigation?.location.freshness!=='fresh'&&<p className="route-data-note">{navigation?.guidance?.location||'当前定位不可用、精度不足或已过期；不据此判断到访。'}</p>}{next&&<div className="route-actions"><p>下一站：{next.name}</p>{navigation?.guidance&&<><p>{navigation.guidance.next_leg}</p>{trip.status==='active'&&<p>{navigation.guidance.remaining}</p>}{trip.status==='active'&&<p>{navigation.guidance.off_route}</p>}</>}<a className="route-primary" href={mapLink({...next,id:next.attraction_id})} target="_blank" rel="noreferrer">打开这一站导航</a><button disabled={busy||trip.status!=='active'} onClick={()=>run(()=>command('confirm_visit',next.stop_id))}>我已到达</button><button disabled={busy||trip.status!=='active'} onClick={()=>run(()=>command('skip_stop',next.stop_id))}>跳过这一站</button></div>}<div className="route-actions"><button disabled={busy} onClick={()=>run(()=>command(trip.status==='paused'?'resume':'pause'))}>{trip.status==='paused'?'恢复游览':'暂停游览'}</button><button className="route-primary" disabled={busy} onClick={finish}>结束游览并查看报告</button></div></section>
 :view==='shuttle'?<ShuttlePanel/>
 :display?<section className="preset-detail">{detail&&<button className="route-back" onClick={()=>setDetail(null)}>返回推荐结果</button>}<h2>{display.name}</h2><ImmersiveTag route={display} onOpen={onImmersive}/>{display.highlights.map(h=><p key={h}>{h}</p>)}{list(display)}{display.warnings.map(w=><p key={w} className="route-data-note">{w}</p>)}{!detail&&trip?.status==='planned'&&<button className="route-primary" disabled={busy||!display.navigation_ready} onClick={()=>run(()=>command('start'))}>开始游览</button>}{!detail&&trip?.status==='completed'&&<button className="route-primary" onClick={onReport}>查看本次回忆</button>}</section>
 :view==='presets'?<ServerPresetRoutePanel filters={filters} onFilters={setFilters} onChoose={setDetail} onAdopt={adopt} step={step} onStep={setStep} busy={busy} onImmersive={onImmersive}/>:<p>请先从官方推荐选择一条路线。</p>}
 {trip&&<details className="server-binding"><summary>连接我的小智</summary><p>对小智说“请给我网页行程的配对码”，将它提供的8位数字填在这里。</p><label>小智配对码<input inputMode="numeric" autoComplete="off" maxLength={8} value={pairCode} onChange={e=>setPairCode(e.target.value.replace(/\D/g,''))}/></label><button disabled={busy||pairCode.length!==8} onClick={()=>run(async()=>{setBinding(await travelRequest(`/trips/${trip.id}/pair-device`,{method:'POST',body:{code:pairCode}}));setPairCode('');})}>连接本次行程</button>{binding?.bound&&<p role="status">已连接本次行程，现在可以问小智“下一站去哪”。连接12小时有效，更换行程需重新配对。</p>}<p>当前为一台演示设备，配对会将它切换到本次行程。主动语音提醒仍需设备端接入。</p></details>}
 {navigation?.reminders?.map(r=><div className="route-data-note" key={r.id}><p>{r.speech_text}</p><button onClick={()=>onImmersive(r.experience_id)}>打开人物视角体验</button></div>)}
 </div></section>;
}
