import {useEffect,useState} from 'react';
import {X} from 'lucide-react';
import {travelRequest} from '../../services/travel-api';
import ServerMemoryPage from './ServerMemoryPage';
import './server-travel.css';
const status={planned:'尚未开始',active:'游览中',paused:'已暂停',completed:'已结束'};
export default function ServerHistoryPage({onClose,onDeleted}){
 const [trips,setTrips]=useState([]),[selected,setSelected]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const refresh=()=>travelRequest('/trips').then(data=>setTrips(data.trips));
 useEffect(()=>{let live=true;travelRequest('/trips').then(data=>{if(live)setTrips(data.trips);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
 const open=async id=>{setError('');try{setSelected(await travelRequest(`/trips/${id}`));}catch(e){setError(e.message);}};
 const deleted=(id,result)=>{setSelected(null);setTrips(old=>old.filter(t=>t.id!==id));onDeleted(id);if(result.media_cleanup_pending)setError('行程已删除，照片清理将在后台重试。');refresh().catch(e=>setError(e.message));};
 if(selected)return <ServerMemoryPage trip={selected} onClose={()=>setSelected(null)} onDeleted={deleted}/>;
 return <div className="overlay"><section className="modal utility-modal server-travel-modal" role="dialog" aria-modal="true" aria-label="历史行程"><button autoFocus className="close-button" onClick={onClose} aria-label="关闭历史行程"><X size={20}/></button><h2>走过的栖霞</h2><p>本浏览器身份下最近50次行程。查看旧回忆不会切换正在游览的路线或小智配对。</p>{loading&&<p role="status">正在读取行程…</p>}{error&&<p role="alert">{error}</p>}{!loading&&!trips.length&&<p>还没有保存的行程，先选择一条路线吧。</p>}{trips.map(t=><article className="server-memory-result" key={t.id}><h3>{t.route.name}</h3><p>{new Date(t.created_at).toLocaleString('zh-CN')} · {status[t.status]}</p><button className="primary" onClick={()=>open(t.id)}>查看记录与回忆</button></article>)}<p className="server-storage-note">凭证有效期7天。清理网站数据或凭证过期后，暂不支持找回旧记录。</p></section></div>;
}
