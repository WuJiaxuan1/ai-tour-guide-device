import {useState} from 'react';
import {DoorOpen,ParkingCircle,Toilet,Info,MapPin,ArrowUpRight,Plus,Utensils,LocateFixed} from 'lucide-react';
import {places,facilities,mapLink} from '../data';
import PlaceImage from './PlaceImage';
import MapPreview from './MapPreview';
import WeatherStrip from '../features/weather/WeatherStrip';
import {nearby,distanceMeters,formatDistance} from '../services/distance';
const icons={'厕所':Toilet,'出入口':DoorOpen,'停车场':ParkingCircle,'游客服务':Info,'餐饮':Utensils};
export default function ExplorePanel({card,saved,onDetail,onAdd,visitor}){
 const [section,setSection]=useState('stories'),[filter,setFilter]=useState('全部'),[kind,setKind]=useState('全部'),[query,setQuery]=useState('');
 const facilityEntries=[...facilities,...places.filter(p=>p.tags.some(t=>Object.hasOwn(icons,t)))];
 const kinds=['全部',...new Set(facilityEntries.flatMap(p=>[p.facilityType,...p.tags]).filter(t=>Object.hasOwn(icons,t)))];
 const stories=places.filter(p=>filter==='全部'||filter==='已收藏'&&saved.includes(p.id)||p.tags.includes(filter));
 const services=facilityEntries.filter(p=>kind==='全部'||p.facilityType===kind||p.tags.includes(kind));
 const shown=nearby((section==='stories'?stories:services).filter(p=>(p.name+' '+(p.address||'')).includes(query.trim())),visitor.position?.location);
 return <section className="explore"><p className="eyebrow">南京 · 栖霞山</p><div className="section-title"><h1>{section==='stories'?'山里，还有这些故事。':'需要的服务，就在这里。'}</h1><p>{section==='stories'?'从红叶、湖水和古桥，发现栖霞。':'查找景区设施，选择目的地。'}</p></div><WeatherStrip/>
 <div className="explore-sections" role="group" aria-label="探索内容"><button className={section==='stories'?'active':''} aria-pressed={section==='stories'} onClick={()=>setSection('stories')}>景点故事 <span>{places.length}</span></button><button className={section==='facilities'?'active':''} aria-pressed={section==='facilities'} onClick={()=>setSection('facilities')}>便民设施 <span>{facilityEntries.length}</span></button></div>
 <div className="filters" aria-label="地点分类">{(section==='stories'?['全部','自然','人文','茶事','遗址','服务','已收藏'].filter(t=>['全部','已收藏'].includes(t)||places.some(p=>p.tags.includes(t))):kinds).map(x=><button key={x} className={(section==='stories'?filter:kind)===x?'active':''} aria-pressed={(section==='stories'?filter:kind)===x} onClick={()=>section==='stories'?setFilter(x):setKind(x)}>{x}</button>)}</div>
 <div className="explore-search"><input aria-label="搜索地点" placeholder="搜索地点" value={query} onChange={e=>setQuery(e.target.value)}/><button onClick={visitor.locate} disabled={visitor.status==='loading'}><LocateFixed size={16}/>{visitor.status==='loading'?'正在定位':visitor.position?'更新位置':'按距离查看'}</button></div>
 {visitor.error&&<p className="location-message" role="status">{visitor.error}</p>}{visitor.position&&<p className="distance-caption">按直线距离由近到远排列 · 定位精度约 {Math.round(visitor.position.accuracy)} m</p>}
 <MapPreview places={shown} visitor={visitor} onDetail={onDetail} title={section==='stories'?'景点分布':'附近服务'}/>
 <div className="places-grid">{shown.map(p=>section==='stories'?card(p):<article className="place-card facility-card" key={p.id}><button className="place-photo" onClick={()=>onDetail(p)} aria-label={`查看${p.name}`}><PlaceImage place={p}/><span>{p.category}</span></button><div className="place-copy"><button className="text-button" onClick={()=>onDetail(p)}><h3>{p.name}</h3></button><p>{p.address}</p>{visitor.position&&<small className="distance-label">直线距离 {formatDistance(distanceMeters(visitor.position.location,p.location))}</small>}<div className="facility-actions"><a className="facility-go" href={mapLink(p)} target="_blank" rel="noreferrer"><MapPin size={14}/>去这里</a><button onClick={()=>onAdd(p.id)}><Plus size={14}/>加入路线</button></div></div></article>)}</div>
 {!shown.length&&<div className="empty"><p>{query?'没有找到这个地点。':'这里还没有收藏的景点。'}</p><button onClick={()=>{setQuery('');setFilter('全部');setKind('全部');}}>查看全部地点 <ArrowUpRight size={15}/></button></div>}</section>;
}
