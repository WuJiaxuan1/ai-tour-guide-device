import {Play,Square,RefreshCw} from 'lucide-react';
import '../features/navigation/demo-trip.css';
export default function DemoTripPanel({demo}){
  const {phase,trip,error,start,end,retry}=demo;
  if(phase==='disabled'||phase==='loading')return null;
  const pending=['starting','ending'].includes(phase);
  const status={idle:'尚未开始',starting:'正在开始…',ending:'正在结束…',syncing:'正在同步…',synced:'已同步到本机服务',error:'同步未确认'}[phase];
  return <section className="demo-trip-panel" aria-label="小智单人演示">
    <strong>与小智分享这次行程</strong>
    <p>演示期间，同步所选地点、顺序、出入口、停留时间和最近三条已发送问题。未发送的输入不会上传。</p>
    <div role="status" className={'demo-trip-status is-'+phase}>{status}{trip&&phase==='synced'?' · '+trip.selectedPlaces.length+'个地点 · 版本'+trip.revision:''}</div>
    {trip&&<small>本次演示于 {new Date(trip.expiresAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} 自动结束。此状态不代表手表已连接。</small>}
    {error&&<p role="alert" className="demo-trip-error">{error}</p>}
    <div className="demo-trip-actions">
      {!trip&&<button disabled={pending} onClick={start}><Play size={14}/>开始单人演示</button>}
      {trip&&<button disabled={pending} onClick={end}><Square size={14}/>结束演示</button>}
      {phase==='error'&&<button onClick={retry}><RefreshCw size={14}/>重试同步</button>}
    </div>
    <small>仅供一位游客和一个专用小智智能体使用；暂不传输GPS、真实路线或到访进度。</small>
  </section>;
}
