import {useEffect,useId,useState} from 'react';
import {Watch,ChevronDown,Check,ArrowRight,Navigation,MapPin,Pause,Play,LoaderCircle,Link,Clock3} from 'lucide-react';
import {mapLink} from '../../data';
import ImmersiveTag from '../../components/ImmersiveTag';
import {travelRequest} from '../../services/travel-api';
import {tourPresentation} from '../../services/tour-presentation.mjs';
import './tour-cards.css';
import RouteTimeline from './RouteTimeline';
export function ActiveTour({serverTrip,busy,run,onHistory,onImmersive,onDetail,setSelected,selected,visitor}){
 const {trip,navigation,command}=serverTrip,next=navigation?.next_stop;
 const finish=()=>run(async()=>{await command('complete');onHistory();});

 const presentation=tourPresentation(navigation,trip.status,visitor?.error);
 return <section className="active-route">
  <header className="tour-title"><h2>{trip.route.name}</h2><span className={'tour-status '+(presentation.paused?'is-paused':'')}>{presentation.paused?'已暂停':'游览中'}</span></header>
  <ImmersiveTag route={trip.route} onOpen={onImmersive}/>
  <div className="route-timeline-heading"><h3>游览进度</h3><span>{trip.route.stops.filter(s=>s.status==='visited').length} / {trip.route.stops.length} 站已手动到访</span></div><RouteTimeline stops={trip.route.stops} active nextStopId={next?.stop_id} selectedId={selected} onSelect={setSelected} onDetail={onDetail} onImmersive={onImmersive}/>
  <section className="tour-next-card" aria-label="下一站导航">
   <div className="tour-next-heading"><span className="tour-card-icon"><Navigation size={22}/></span><div><span className="tour-eyebrow">{presentation.paused?'恢复后前往':'接下来前往'}</span><h3>{next?.name||(navigation?'已处理所有停靠点':'正在读取下一站…')}</h3></div></div>
   <div className="tour-location" role="status"><MapPin size={16}/><p>{presentation.location}</p>{!presentation.paused&&navigation?.location?.freshness!=='fresh'&&visitor?.locate&&<button type="button" onClick={visitor.locate} disabled={visitor.status==='loading'}>{visitor.status==='loading'?'定位中…':'重新定位'}</button>}</div>
   {presentation.messages.length>0&&<div className="tour-guidance">{presentation.messages.map(text=><p key={text}>{text}</p>)}</div>}
   {next?<div className="tour-next-actions"><a className="route-primary" href={mapLink({...next,id:next.attraction_id})} target="_blank" rel="noreferrer"><Navigation size={16}/>打开地图导航</a><button className="tour-secondary" disabled={busy||presentation.paused} onClick={()=>run(()=>command('confirm_visit',next.stop_id))}><Check size={16}/>我已到达</button><button className="tour-skip" disabled={busy||presentation.paused} onClick={()=>run(()=>command('skip_stop',next.stop_id))}>跳过本站<ArrowRight size={14}/></button></div>:<p className="tour-empty-note">{navigation?'可以结束游览，查看这一程的记录。':'行程同步中，请稍候。'}</p>}
  </section>
  <div className="tour-footer-actions"><button className="tour-secondary" disabled={busy} onClick={()=>run(()=>command(presentation.paused?'resume':'pause'))}>{presentation.paused?<Play size={16}/>:<Pause size={16}/>} {presentation.paused?'恢复游览':'暂停游览'}</button><button className="route-text-button" disabled={busy} onClick={finish}>结束游览并查看历史行程<ArrowRight size={15}/></button></div>
 </section>;
}
export function DevicePairing({trip,busy,run}){
 const [binding,setBinding]=useState(null),[pairCode,setPairCode]=useState(''),[pairing,setPairing]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState(false);
 const [watchState,setWatchState]=useState(null);
 const fieldId=useId(),helpId=useId(),errorId=useId();
 useEffect(()=>{setBinding(null);setWatchState(null);setEditing(false);setError('');if(!trip)return;let live=true,timer;const controller=new AbortController();const refresh=async()=>{try{const result=await travelRequest(`/trips/${trip.id}/pair-device`,{signal:controller.signal});if(!live)return;setBinding(result.bound?result:null);if(result.bound&&result.watch_linked){const state=await travelRequest(`/trips/${trip.id}/watch/navigation`,{signal:controller.signal});if(live)setWatchState(state);}else setWatchState(null);}catch{if(live)setWatchState({status:'unavailable'});}finally{if(live)timer=setTimeout(refresh,5000);}};refresh();return()=>{live=false;clearTimeout(timer);controller.abort();};},[trip?.id]);
 useEffect(()=>{if(!binding)return;const remaining=Date.parse(binding.expires_at)-Date.now();const expire=()=>{setBinding(null);setError('连接已到期，请向枫叶精灵获取新的配对码。');};if(remaining<=0){expire();return;}const timer=setTimeout(expire,remaining);return()=>clearTimeout(timer);},[binding]);
 if(!trip)return null;
 const submit=e=>{e.preventDefault();if(busy||pairing||pairCode.length!==8)return;setPairing(true);setError('');run(async()=>{try{const result=await travelRequest(`/trips/${trip.id}/pair-device`,{method:'POST',body:{code:pairCode}});if(!result.bound)throw Error('连接未完成，请重新获取配对码后再试。');setBinding(result);setPairCode('');setEditing(false);}catch(e){setError(e.message);}finally{setPairing(false);}});};
 return <details className="xiaozhi-pairing" open>
  <summary><span className="tour-card-icon"><Watch size={23}/></span><span className="pairing-heading"><strong>连接我的枫叶精灵</strong><small>一次配对，问路、听讲解、查看手表地图</small></span><span className={'pairing-badge '+(binding?.bound?'is-bound':'')}>{binding?.bound?'本次配对成功':'行程配对'}</span><ChevronDown className="pairing-chevron" size={18}/></summary>
  <div className="pairing-body">
   <div className="pairing-trip"><MapPin size={15}/><span>当前行程 · {trip.route.name}</span></div>
   {binding?.bound&&!editing?<div className="pairing-success" role="status"><span><Check size={20}/></span><div><strong>本次行程已连接</strong><p>现在可以问枫叶精灵：“下一站去哪？”</p>{binding.watch_linked?<p>{watchState?.status==='ready'?(watchState.ack?.session===watchState.session?'手表已确认接收地图和路线。':'地图已准备，切到手表地图页即可接收。'):({waiting_location:'等待手机定位，请保持网页打开并允许定位。',preparing:'正在准备下一站地图…',paused:'游览已暂停。',planned:'开始游览后，地图将自动发送到手表。',completed:'本次游览已结束。',finished:'已处理全部停靠点。',error:'地图暂时无法生成，请稍后重试。',unavailable:'暂时无法读取连接状态，正在重试。'}[watchState?.status]||'正在读取手表地图状态…')}</p>:<p>本次连接仅关联语音；升级手表并重新获取配对码后可同时关联地图。</p>}<small>有效至 {new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(binding.expires_at))}，更换行程需重新配对。</small><button type="button" onClick={()=>setEditing(true)}>重新配对</button></div></div>:<>
    <ol className="pairing-steps"><li><span>1</span><div><strong>向枫叶精灵获取配对码</strong><p>对枫叶精灵说：</p><blockquote>“请给我网页行程的配对码”</blockquote></div></li><li><span>2</span><div><strong>输入配对码，连接这一程</strong><p id={helpId}>填写枫叶精灵提供的 8 位数字。</p></div></li></ol>
    <form className="pairing-form" onSubmit={submit} aria-busy={pairing}><label htmlFor={fieldId}>枫叶精灵配对码</label><div className="pairing-input-row"><input id={fieldId} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} placeholder="8 位数字" value={pairCode} disabled={busy||pairing} aria-invalid={Boolean(error)} aria-describedby={`${helpId}${error?' '+errorId:''}`} onChange={e=>{setPairCode(e.target.value.replace(/\D/g,''));setError('');}}/><button type="submit" className="route-primary" disabled={busy||pairing||pairCode.length!==8}>{pairing?<LoaderCircle className="pairing-spinner" size={16}/>:<Link size={16}/>} {pairing?'正在连接…':'连接行程'}</button></div>{error&&<p id={errorId} className="pairing-error" role="alert">{error}</p>}{editing&&<button type="button" className="route-text-button" onClick={()=>{setEditing(false);setError('');}}>返回连接结果</button>}</form>
   </>}
   <p className="pairing-footnote"><Clock3 size={14}/><span>配对有效期为 12 小时。游览时保持手机网页定位和手表联网，下一站地图会自动更新。</span></p>
  </div>
 </details>;
}
export function NavigationReminders({navigation,onImmersive}){
 return navigation?.reminders?.map(r=><div className="route-data-note" key={r.id}><p>{r.speech_text}</p><button onClick={()=>onImmersive(r.experience_id)}>打开人物视角体验</button></div>);
}
