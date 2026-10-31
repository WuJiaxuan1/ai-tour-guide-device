import {useEffect,useState} from 'react';
import {X,FileText,BookOpen,ArrowUpRight} from 'lucide-react';
import {travelRequest} from '../../services/travel-api';
import ServerTripRecord from './ServerTripRecord';
import ReportPage from './ReportPage';
import JournalPage from './JournalPage';
import './server-travel.css';
import './history-services.css';
const status={planned:'尚未开始',active:'游览中',paused:'已暂停',completed:'已结束'};
export default function ServerHistoryPage({onClose,onDeleted}){
 const [trips,setTrips]=useState([]),[selected,setSelected]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[opening,setOpening]=useState(null);
 const refresh=()=>travelRequest('/trips').then(data=>setTrips(data.trips));
 useEffect(()=>{let live=true;travelRequest('/trips').then(data=>{if(live)setTrips(data.trips);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
 const open=async(id,view)=>{if(opening)return;setError('');setOpening(id);try{setSelected({trip:await travelRequest(`/trips/${id}`),view});}catch(e){setError(e.message);}finally{setOpening(null);}};
 const deleted=(id,result)=>{setSelected(null);setTrips(old=>old.filter(t=>t.id!==id));onDeleted(id);if(result.media_cleanup_pending)setError('行程已删除，照片清理将在后台重试。');refresh().catch(e=>setError(e.message));};
 if(selected?.view==='report')return <ReportPage trip={selected.trip} onClose={()=>setSelected(null)} onManage={()=>setSelected(s=>({...s,view:'manage'}))}/>;
 if(selected?.view==='journal')return <JournalPage trip={selected.trip} onClose={()=>setSelected(null)}/>;
 if(selected)return <ServerTripRecord trip={selected.trip} onClose={()=>setSelected(s=>({...s,view:'report'}))} onDeleted={deleted}/>;
 return <div className="overlay"><section className="modal utility-modal server-travel-modal trip-history" role="dialog" aria-modal="true" aria-label="历史行程"><button autoFocus className="close-button" onClick={onClose} aria-label="关闭历史行程"><X size={20}/></button><h2>走过的栖霞</h2><p>每一程，都有值得留下的风景。</p>{loading&&<p role="status">正在读取行程…</p>}{error&&<p role="alert">{error}</p>}{!loading&&!trips.length&&<p>还没有保存的行程，先选择一条路线吧。</p>}{trips.map(t=><article className="history-trip-card" key={t.id}><header><h3>{t.route.name}</h3><span>{status[t.status]}</span></header><p className="history-trip-date">{new Date(t.created_at).toLocaleString('zh-CN')}</p><div className="history-feature-grid"><button disabled={Boolean(opening)} onClick={()=>open(t.id,'report')}><FileText size={23}/><span><strong>游览报告</strong><small>回顾沿途景点</small></span><ArrowUpRight size={16}/></button><button disabled={Boolean(opening)} onClick={()=>open(t.id,'journal')}><BookOpen size={23}/><span><strong>专属手账</strong><small>用照片收藏这一程</small></span><ArrowUpRight size={16}/></button></div>{opening===t.id&&<p role="status">正在打开行程…</p>}</article>)}<p className="server-storage-note">查看历史不会切换当前路线或枫叶精灵配对。保留最近 50 次行程；本浏览器凭证有效期 7 天，清理网站数据后暂不支持找回。</p></section></div>;
}
