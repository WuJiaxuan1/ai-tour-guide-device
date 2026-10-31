import {ArrowRight,ArrowUpRight,Flag,Check,SkipForward,Clock3} from 'lucide-react';
import {byId} from '../../data';
import ImmersiveTag from '../../components/ImmersiveTag';
import './route-timeline.css';

// Keep stop occurrence IDs: a round trip can visit the same place more than once.
export default function RouteTimeline({stops,selectedId,onSelect,onDetail,onImmersive,active=false,nextStopId,minutes={},onStay,hasExit=true}){
 return <ol className={'route-timeline'+(active?' is-active-tour':'')} aria-label={active?'游览进度':'路线途经顺序'}>
  {stops.map((stop,index)=>{
   const id=stop.stopId??stop.stop_id;
   const placeId=stop.placeId??stop.attraction_id;
   const start=index===0,end=hasExit&&index===stops.length-1;
   const visited=active&&stop.status==='visited',skipped=active&&stop.status==='skipped';
   const next=active&&!visited&&!skipped&&id===nextStopId;
   const repeated=stops.slice(0,index).some(s=>(s.placeId??s.attraction_id)===placeId);
   const stay=minutes[placeId]??stop.stayMinutes??(Number.isFinite(stop.planned_stay_seconds)?stop.planned_stay_seconds/60:null);
   const Icon=visited?Check:skipped?SkipForward:start?ArrowRight:end?Flag:null;
   const state=visited?'已手动到访':skipped?'已跳过':next?'下一站':null;
   const place=byId(placeId);
   return <li key={id} data-stop-id={id} className={['route-timeline-stop',start?'is-start':'',end?'is-end':'',visited?'is-visited':'',skipped?'is-skipped':'',next?'is-next':'',selectedId===id?'is-selected':''].filter(Boolean).join(' ')}>
    <div className="route-timeline-rail" aria-hidden="true"><span className={'route-timeline-node'+(Icon?' has-icon':'')}>{Icon&&<Icon size={17}/>}</span></div>
    <div className="route-timeline-body">
     <div className="route-timeline-stop-heading"><button type="button" className="route-timeline-name" aria-pressed={selectedId===id} aria-label={`在地图上查看${start?'起点':end?'终点':'第'+(index+1)+'站'}：${stop.name}`} onClick={()=>onSelect(id)}>{stop.name}</button><div className="route-timeline-labels">{(start||end)&&<span>{start?'起点':'终点'}</span>}{state&&<span className="route-timeline-status">{state}</span>}</div></div>
     <div className="route-timeline-meta">{start?'从这里开启这一程':end?'在这里结束这一程':Number.isFinite(stay)?`${active?'计划':'建议'}停留 ${stay} 分钟`:'停留时间待确定'}{repeated&&!end&&' · 再次经过'}</div>
     <ImmersiveTag placeId={placeId} onOpen={onImmersive}/>
     {(!start&&!end)&&(place||onStay)&&<div className="route-timeline-tools">{place&&<button type="button" onClick={()=>onDetail(place)}>查看地点介绍<ArrowUpRight size={14}/></button>}{onStay&&<button type="button" onClick={()=>onStay({...stop,id:placeId})}><Clock3 size={14}/>调整停留</button>}</div>}
    </div>
   </li>;
  })}
 </ol>;
}
