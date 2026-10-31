import {useRef,useEffect} from 'react';
import {Check,ArrowRight,ArrowLeft} from 'lucide-react';
import ImmersiveTag from '../../components/ImmersiveTag';
import {matchPresets} from '../../../../shared/routes.mjs';
const steps=[
 {key:'gate',title:'从哪一扇门开始？',hint:'选择你准备进入景区的入口。',options:[['west','西门'],['south','南门']]},
 {key:'duration',title:'留多少时间给山里？',hint:'按你的游玩时间挑选路线。',options:[['half','半天'],['full','全天']]},
 {key:'intensity',title:'今天想走得轻松一些吗？',hint:'选一个适合自己的游览节奏。',options:[['easy','轻松'],['normal','正常'],['energetic','能量无限']]},
 {key:'companions',title:'这次和谁一起出发？',hint:'老人和儿童可以同时选择，路线会自动调整为节省体力。',options:[['senior','有老人同行'],['child','有儿童同行'],['none','无特殊同行人员']]},
];
export default function PresetRoutePanel({data,filters,onFilters,onChoose,onAdopt,step,onStep,onImmersive}){
 const heading=useRef(null),initial=useRef(true);
 useEffect(()=>{if(initial.current){initial.current=false;return;}heading.current?.focus({preventScroll:true});},[step]);
 const current=steps[step],result=matchPresets(filters,data);
 const selected=value=>current.key==='companions'?Array.isArray(filters.companions)?filters.companions.includes(value):filters.companions===value:filters[current.key]===value;
 const pick=value=>{if(current.key!=='companions')return onFilters({...filters,[current.key]:value});const old=Array.isArray(filters.companions)?filters.companions:filters.companions?[filters.companions]:[];const next=value==='none'?['none']:old.includes(value)?old.filter(v=>v!==value):[...old.filter(v=>v!=='none'),value];onFilters({...filters,companions:next.length?next:null});};
 const valid=current&&(current.key==='companions'?Boolean(filters.companions?.length):Boolean(filters[current.key]));
 return <section aria-label="官方推荐路线" className="preset-wizard">
 {current?<><div className="wizard-progress" aria-label={`第 ${step+1} 步，共 4 步`}>{steps.map((s,i)=><span key={s.key} className={i<=step?'reached':''} aria-current={i===step?'step':undefined}>{i+1}<small>{['入口','时长','体力','同行'][i]}</small></span>)}</div><h2 ref={heading} tabIndex={-1}>{current.title}</h2><p>{current.hint}</p><div className="preference-pills" role="group" aria-label={current.title}>{current.options.map(([value,label])=><button key={value} aria-pressed={selected(value)} onClick={()=>pick(value)}>{selected(value)&&<Check size={17} aria-hidden="true"/>}{label}</button>)}</div>{step===3&&result.effective.lowEffort&&<p className="route-data-note" role="status">已按同行人员调整为节省体力，覆盖之前选择的体力强度。</p>}<div className="wizard-actions">{step>0&&<button onClick={()=>onStep(step-1)}><ArrowLeft size={16} aria-hidden="true"/>上一步</button>}<button className="route-primary" disabled={!valid} onClick={()=>onStep(step+1)}>{step===3?'查看推荐':'下一步'}<ArrowRight size={16} aria-hidden="true"/></button><button className="wizard-skip" onClick={()=>{onFilters({...filters,[current.key]:null});onStep(step+1);}}>跳过这一步</button></div></>
 :<><button className="route-back" onClick={()=>onStep(0)}><ArrowLeft size={16}/>修改偏好</button><h2 ref={heading} tabIndex={-1}>适合你的山中一程</h2>{result.effective.lowEffort&&<p className="route-data-note">有老人或儿童同行，已按节省体力匹配。</p>}<p className="route-match-note" role="status">{result.routes.length?`找到 ${result.routes.length} 条预设路线`:'现有预设路线暂未覆盖这组条件，请调整或跳过部分条件。'}</p><div className="preset-route-results">{result.routes.map(route=><article className="preset-route-card" key={route.routeId}><span className="route-kicker">{route.entryGateId==='west'?'西门出发':'南门出发'} · 官方约 {route.officialDurationMinutes/60} 小时</span><h3>{route.name}</h3><ImmersiveTag route={route} onOpen={onImmersive}/><p>{route.description}</p><ol className="route-flow" aria-label="路线顺序">{route.stops.map(s=><li key={s.stopId}>{s.name}</li>)}</ol><div className="route-card-meta"><span>{route.uniqueNodeCount} 处地点</span>{route.completeness==='missing_exit'&&<span>返程待确认</span>}</div><button className="route-primary" onClick={()=>onAdopt(route)}>添加到专属路线</button><button className="route-card-open" onClick={()=>onChoose(route)}>查看路线详情<ArrowRight size={17}/></button></article>)}</div></>}
 </section>;
}
