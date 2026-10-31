import {useState} from 'react';
import {byId,mapLink} from '../../data';
import ImmersiveTag from '../../components/ImmersiveTag';
import {travelRequest} from '../../services/travel-api';
export function ActiveTour({serverTrip,busy,run,onReport,onImmersive,onDetail,setSelected}){
 const {trip,navigation,command}=serverTrip,next=navigation?.next_stop;
 const finish=()=>run(async()=>{await command('complete');onReport();});
 const list=r=><ol className="preset-stop-list">{r.stops.map((s,i)=><li key={s.stop_id}><button onClick={()=>setSelected(s.stop_id)}>{i+1}</button><div><strong>{s.name}</strong><ImmersiveTag placeId={s.attraction_id} onOpen={onImmersive}/><small>{s.status==='visited'?'已手动到访':s.status==='skipped'?'已跳过':`计划停留 ${s.planned_stay_seconds/60} 分钟`}</small>{byId(s.attraction_id)&&<button onClick={()=>onDetail(byId(s.attraction_id))}>查看讲解</button>}</div></li>)}</ol>;
 return <section className="active-route"><h2>{trip.route.name}</h2><ImmersiveTag route={trip.route} onOpen={onImmersive}/><p>{trip.status==='paused'?'游览已暂停':'行程记录已同步到服务器'}</p>{list(trip.route)}{navigation?.location.freshness==='fresh'&&<p className="route-data-note">当前位置参考：{navigation.current_place?.name?`已接近${navigation.current_place.name}`:navigation.location.address?.status==='resolved'?`${navigation.location.address.formatted_address}附近（高德）`:'已收到手机定位，附近地址暂不可用'}。定位不等于确认到访。</p>}{navigation?.location.freshness!=='fresh'&&<p className="route-data-note">{navigation?.guidance?.location||'当前定位不可用、精度不足或已过期；不据此判断到访。'}</p>}{next&&<div className="route-actions"><p>下一站：{next.name}</p>{navigation?.guidance&&<><p>{navigation.guidance.next_leg}</p>{trip.status==='active'&&<p>{navigation.guidance.remaining}</p>}{trip.status==='active'&&<p>{navigation.guidance.off_route}</p>}</>}<a className="route-primary" href={mapLink({...next,id:next.attraction_id})} target="_blank" rel="noreferrer">打开这一站导航</a><button disabled={busy||trip.status!=='active'} onClick={()=>run(()=>command('confirm_visit',next.stop_id))}>我已到达</button><button disabled={busy||trip.status!=='active'} onClick={()=>run(()=>command('skip_stop',next.stop_id))}>跳过这一站</button></div>}<div className="route-actions"><button disabled={busy} onClick={()=>run(()=>command(trip.status==='paused'?'resume':'pause'))}>{trip.status==='paused'?'恢复游览':'暂停游览'}</button><button className="route-primary" disabled={busy} onClick={finish}>结束游览并查看报告</button></div></section>;
}
export function DevicePairing({trip,busy,run}){
 const [binding,setBinding]=useState(null),[pairCode,setPairCode]=useState('');
 if(!trip)return null;
 return <details className="server-binding"><summary>连接我的小智</summary><p>对小智说“请给我网页行程的配对码”，将它提供的8位数字填在这里。</p><label>小智配对码<input inputMode="numeric" autoComplete="off" maxLength={8} value={pairCode} onChange={e=>setPairCode(e.target.value.replace(/\D/g,''))}/></label><button disabled={busy||pairCode.length!==8} onClick={()=>run(async()=>{setBinding(await travelRequest(`/trips/${trip.id}/pair-device`,{method:'POST',body:{code:pairCode}}));setPairCode('');})}>连接本次行程</button>{binding?.bound&&<p role="status">已连接本次行程，现在可以问小智“下一站去哪”。连接12小时有效，更换行程需重新配对。</p>}<p>当前为一台演示设备，配对会将它切换到本次行程。主动语音提醒仍需设备端接入。</p></details>;
}
export function NavigationReminders({navigation,onImmersive}){
 return navigation?.reminders?.map(r=><div className="route-data-note" key={r.id}><p>{r.speech_text}</p><button onClick={()=>onImmersive(r.experience_id)}>打开人物视角体验</button></div>);
}
