import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {travelRequest,requestId} from '../../services/travel-api';
import {TEMPLE_EXPERIENCE} from '../../../../shared/immersive.mjs';
import {saveImmersiveAction} from '../../services/immersive-save.mjs';
import './server-travel.css';
export default function ServerImmersivePage({experienceId,serverTrip,onClose}){
 const frame=useRef(null),channel=useRef(requestId()),current=useRef(serverTrip),processing=useRef(false);
 const [error,setError]=useState(''),[ready,setReady]=useState(false);current.current=serverTrip;
 const tripId=useRef(serverTrip.trip?.id||null);
 const savedTrip=useRef(serverTrip.trip);
 useEffect(()=>{
  const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';let alive=true;
  const state=t=>{const s=t?.immersive_sessions?.find(s=>s.experience_id===experienceId);return s?{current_scene:s.current_scene,choices:s.choices.map(c=>({choice_id:c.choice_id})),completed_at:s.completed_at}:null;};
  const post=data=>{if(alive)frame.current?.contentWindow?.postMessage({app:'qixia-immersive',channel:channel.current,...data},location.origin);};
  const receive=async event=>{
   const d=event.data;if(event.origin!==location.origin||event.source!==frame.current?.contentWindow||d?.app!=='qixia-immersive'||d.channel!==channel.current)return;
   if(d.type==='ready'){setReady(true);post({type:'init',state:state(current.current.trip)});return;}
   if(d.type!=='action'||typeof d.id!=='string'||d.id.length>80)return;
   if(processing.current){post({type:'result',id:d.id,error:'上一步仍在保存，请稍候。'});return;}
   if(!['open','choice','restart'].includes(d.action)){post({type:'result',id:d.id,error:'体验操作无效。'});return;}
   if(!tripId.current){post({type:'result',id:d.id,state:null});return;}
   if(current.current.trip?.id!==tripId.current){post({type:'result',id:d.id,error:'当前行程已切换，请关闭体验后重新打开。'});return;}
   processing.current=true;setError('');
   try{
    const t=current.current.trip.version>savedTrip.current.version?current.current.trip:savedTrip.current;
    const result=await saveImmersiveAction(travelRequest,t,{client_event_id:d.id,experience_id:experienceId,...(d.action==='choice'?{choice_id:d.choice}:{}),...(d.action==='restart'?{action:'restart'}:{})},()=>current.current.trip?.id===tripId.current);
    savedTrip.current=result;post({type:'result',id:d.id,state:state(result)});
    current.current.refresh(tripId.current).catch(()=>{});
   }catch(e){setError(e.message);post({type:'result',id:d.id,error:e.message});}finally{processing.current=false;}
  };
  window.addEventListener('message',receive);return()=>{alive=false;document.body.style.overflow=oldOverflow;window.removeEventListener('message',receive);};
 },[experienceId]);
 if(experienceId!==TEMPLE_EXPERIENCE.id)return null;
 return <div className="overlay immersive-shell" role="dialog" aria-modal="true" aria-label="栖霞寺沉浸式体验"><div className="immersive-toolbar"><span>栖霞寺 · 沉浸式体验{!tripId.current?' · 自由浏览':''}</span><button autoFocus onClick={onClose} aria-label="关闭沉浸式体验"><X size={18}/>返回游览</button></div>{error&&<p role="alert" className="immersive-error">{error}</p>}{!ready&&<p role="status">正在打开山中人生…</p>}<iframe ref={frame} title="我把家，留给了这座山" src={`${TEMPLE_EXPERIENCE.entry_path}#channel=${channel.current}`} allow="autoplay"/><p className="immersive-storage">{tripId.current?'选择和完成状态会保存到本次行程；这不等于实地到访。':'自由浏览不写入行程；开始旅行后可记录体验。'}</p></div>;
}
