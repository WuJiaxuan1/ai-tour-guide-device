import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Maximize2,X,MapPin} from 'lucide-react';
import NavigationMap from './NavigationMap';
import {formatDistance,distanceMeters} from '../services/distance';
export default function MapPreview({places,visitor,onDetail,title='在地图上查看'}){
 const stops=useMemo(()=>places.filter(p=>p.location).map((p,i)=>({...p,number:i+1})),[places]);
 const [selected,setSelected]=useState(null),[open,setOpen]=useState(false);const dialog=useRef(null),trigger=useRef(null);
 const select=useCallback(id=>setSelected(id),[]);
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
 if(!stops.length)return null;
 const p=stops.find(v=>v.id===selected)||stops[0];
 return <><div className="map-preview"><NavigationMap compact stops={stops} selectedId={selected} onSelect={select} userPosition={visitor?.position}/><button ref={trigger} className="map-preview-open" onClick={()=>setOpen(true)} aria-label={`${title}，${stops.length}个地点`}><span><MapPin size={15}/>{title} · {stops.length} 个地点</span><Maximize2 size={18}/></button></div>
 <dialog ref={dialog} className="places-map-dialog" onCancel={()=>setOpen(false)} onClose={()=>{setOpen(false);trigger.current?.focus();}}><div className="places-map-header"><h2>{title}</h2><button aria-label="关闭地图" onClick={()=>setOpen(false)}><X size={22}/></button></div>{open&&<div className="places-map-body"><NavigationMap compact stops={stops} selectedId={selected} onSelect={select} userPosition={visitor?.position} onLocate={visitor?.locate}/></div>}
 <div className="places-map-list">{stops.map(v=><button key={v.id} aria-pressed={v.id===p.id} onClick={()=>setSelected(v.id)}>{v.number}. {v.name}</button>)}</div><button className="map-selected-place" onClick={()=>{setOpen(false);onDetail(p);}}><strong>{p.name}</strong><span>{visitor?.position?`直线距离 ${formatDistance(distanceMeters(visitor.position.location,p.location))}`:'查看地点详情'}</span></button></dialog></>;
}
