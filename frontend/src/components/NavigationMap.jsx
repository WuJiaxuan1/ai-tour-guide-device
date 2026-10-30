import {useEffect, useRef, useState} from 'react';
import {MapPin, Map as MapIcon, LocateFixed, Plus, Minus, RotateCcw} from 'lucide-react';
import {loadAMap} from '../services/amap';

// An approximate camera position, never used as a POI or route endpoint.
const overview = [118.960, 32.153];

export default function NavigationMap({stops, geometry, selectedId, onSelect, onIllustration, userPosition, onLocate, compact=false}) {
  const container = useRef(null), map = useRef(null), sdk = useRef(null), overlays = useRef([]), previousSelected = useRef(selectedId);
  const userMarker=useRef(null);
  const [status, setStatus] = useState('loading');
  const fit = () => {
    if (map.current && overlays.current.length) map.current.setFitView(overlays.current, false, [60, !compact && window.innerWidth > 700 ? 405 : 45, 55, 45], 17);
    else map.current?.setZoomAndCenter(14, overview);
  };
  useEffect(() => {
    let disposed = false, instance, timer;
    timer = setTimeout(() => {if (!disposed) setStatus('error');}, 20000);
    loadAMap().then(AMap => {
      if (disposed) return;
      sdk.current = AMap;
      instance = new AMap.Map(container.current, {viewMode: '2D', center: overview, zoom: 14,
        animateEnable: !window.matchMedia('(prefers-reduced-motion: reduce)').matches});
      map.current = instance;
      instance.on('complete', () => {if (!disposed) {clearTimeout(timer);setStatus('ready');}});
    }).catch(error => {
      if (!disposed) {clearTimeout(timer);setStatus(error.message === 'MAP_NOT_CONFIGURED' ? 'unconfigured' : 'error');}
    });
    return () => {disposed = true;clearTimeout(timer);instance?.destroy();map.current = null;overlays.current = [];};
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    const AMap = sdk.current, instance = map.current;
    if (!AMap || !instance) return;
    instance.remove(overlays.current);
    const markers = stops.filter(stop => stop.location).map(stop => {
      const content = document.createElement('button');
      content.type = 'button';content.className = 'amap-stop-marker';content.textContent = String(stop.number||1);
      content.setAttribute('aria-label', `第${stop.number}站 ${stop.name}`);
      const marker = new AMap.Marker({position: stop.location, content, anchor: 'bottom-center'});
      marker.on('click', () => onSelect(stop.id));
      return marker;
    });
    const line = geometry ? [new AMap.Polyline({path: geometry.coordinates, strokeColor: '#b65e77',
      strokeWeight: 6, strokeOpacity: .92, lineJoin: 'round', lineCap: 'round', showDir: true})] : [];
    overlays.current = [...line, ...markers];instance.add(overlays.current);
    fit();
  }, [status, stops, geometry, onSelect]);

  useEffect(()=>{if(status!=='ready'||!container.current)return;let timer;const observer=new ResizeObserver(()=>{clearTimeout(timer);timer=setTimeout(fit,180);});observer.observe(container.current);return()=>{observer.disconnect();clearTimeout(timer);};},[status,compact]);

  useEffect(() => {
    if (previousSelected.current === selectedId) return;
    previousSelected.current = selectedId;
    const selected = stops.find(stop => stop.id === selectedId);
    if (status === 'ready' && selected?.location) map.current?.panTo(selected.location);
  }, [selectedId, status, stops]);

  useEffect(()=>{if(status!=='ready'||!map.current||!userPosition)return;const AMap=sdk.current;map.current.remove(userMarker.current?[userMarker.current]:[]);const dot=document.createElement('div');dot.className='visitor-location-dot';dot.setAttribute('aria-label','我的位置');userMarker.current=new AMap.Marker({position:userPosition.location,content:dot,anchor:'center',zIndex:150});map.current.add(userMarker.current);},[status,userPosition]);
  return <div className={`navigation-map ${compact?'compact-map':''}`}>

    <div ref={container} className="amap-canvas" role="region" aria-label="栖霞山高德地图"/>
    {status !== 'ready' && <div className="map-connection" role="status">
      <span className="map-connection-icon"><MapPin size={28} strokeWidth={1.25}/></span>
      <h2>{status === 'loading' ? '正在打开山里的地图' : status === 'unconfigured' ? '地图服务尚未连接' : '地图暂时无法打开'}</h2>
      <p>{status === 'loading' ? '查看景点位置与步行道路。' : '你仍然可以挑选景点、调整顺序，或查看景区导览图。'}</p>
      <div>{onIllustration&&<button onClick={onIllustration}><MapIcon size={15}/>查看景区导览图</button>}
        {['error','unconfigured'].includes(status) && <button onClick={() => window.location.reload()}><RotateCcw size={15}/>重新加载</button>}</div>
    </div>}
    {status === 'ready' && <div className="navigation-map-tools">
      <button aria-label="放大地图" onClick={() => map.current.zoomIn()}><Plus size={18}/></button>
      <button aria-label="缩小地图" onClick={() => map.current.zoomOut()}><Minus size={18}/></button>
      {onLocate&&<button aria-label="定位到我的位置" onClick={()=>{onLocate();if(userPosition)map.current.panTo(userPosition.location);}}><MapPin size={18}/></button>}
      <button aria-label="查看全部景点" onClick={fit}><LocateFixed size={18}/></button>
    </div>}
  </div>;
}
