import {useState} from 'react';
import {X} from 'lucide-react';
import {travelRequest} from '../../services/travel-api';
const status={planned:'尚未开始',active:'游览中',paused:'已暂停',completed:'已结束'};
export default function ServerTripRecord({trip,onClose,onDeleted}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const remove=async()=>{
  if(!window.confirm('删除服务器上的这次行程、问答、旅行感受、回忆和照片？此操作不可撤销；本机聊天列表需要另行清理。'))return;
  setBusy(true);setError('');
  try{const latest=await travelRequest(`/trips/${trip.id}`);const result=await travelRequest(`/trips/${trip.id}`,{method:'DELETE',body:{expected_version:latest.version}});onDeleted(trip.id,result);}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <div className="overlay"><section className="modal utility-modal server-travel-modal" role="dialog" aria-modal="true" aria-label="历史行程记录"><button autoFocus className="close-button" onClick={onClose} aria-label="返回历史行程"><X size={20}/></button><h2>{trip.route.name}</h2><p>{status[trip.status]} · {new Date(trip.created_at).toLocaleString('zh-CN')}</p>{trip.started_at&&<p>开始：{new Date(trip.started_at).toLocaleString('zh-CN')}</p>}{trip.ended_at&&<p>结束：{new Date(trip.ended_at).toLocaleString('zh-CN')}</p>}<ol className="preset-stop-list">{trip.route.stops.map(s=><li key={s.stop_id}><div><strong>{s.name}</strong><small>{s.status==='visited'?'已手动到访':s.status==='skipped'?'已跳过':'尚未确认到访'}</small></div></li>)}</ol>
 {trip.immersive_sessions?.map(e=><details className="server-memory-result" key={e.experience_id}><summary>栖霞寺沉浸式存档 · {e.completed_at?'已完成':'进行中'}</summary>{e.choices?.map((c,i)=><p key={i}>{c.label||c.choice_id}</p>)}<p>查看此存档不会切换当前行程。</p></details>)}
 {error&&<p role="alert">{error}</p>}<button disabled={busy||!['planned','completed'].includes(trip.status)} onClick={remove}>{busy?'正在删除…':'删除这次行程及照片'}</button>{['active','paused'].includes(trip.status)&&<p>请先结束游览，再删除。</p>}<p className="server-storage-note">删除服务器记录不会清理本机聊天列表。</p></section></div>;
}
