import {useCallback,useEffect,useRef,useState} from 'react';
import {loadAMap} from './amap';
export default function useVisitorLocation(){
 const [position,setPosition]=useState(null),[status,setStatus]=useState('idle'),[error,setError]=useState('');
 const generation=useRef(0),watch=useRef(null),last=useRef(0);
 const locate=useCallback(()=>{
  if(!window.isSecureContext){setError('当前连接无法获取手机位置，请通过 HTTPS 网址打开后重试。');setStatus('error');return;}
  if(!navigator.geolocation){setError('这个浏览器无法获取位置，请换用手机自带浏览器。');setStatus('error');return;}
  const token=++generation.current;if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);last.current=0;setStatus('loading');setError('');
  watch.current=navigator.geolocation.watchPosition(async p=>{
   if(token!==generation.current||Date.now()-last.current<10000)return;last.current=Date.now();
   try{const sdk=await loadAMap();const converted=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('位置转换超时，请重试。')),10000);sdk.convertFrom([p.coords.longitude,p.coords.latitude],'gps',(s,d)=>{clearTimeout(t);if(s==='complete'&&d.locations?.[0])resolve(d.locations[0]);else reject(Error('暂时无法显示地图位置，请重试。'));});});
    if(token!==generation.current)return;setPosition({location:[converted.lng,converted.lat],accuracy:p.coords.accuracy,at:p.timestamp,coordinateSystem:'GCJ02'});setStatus('ready');setError('');
   }catch(e){if(token===generation.current){setStatus('error');setError(e.message==='MAP_NOT_CONFIGURED'?'地图服务尚未连接，暂时不能换算位置。':e.message);}}
  },e=>{if(token!==generation.current)return;setStatus('error');setError(e.code===1?'定位权限未开启，请在浏览器设置中允许访问位置。':e.code===3?'获取位置超时，请到信号较好的地方重试。':'暂时无法获取位置，请稍后重试。');},{enableHighAccuracy:true,maximumAge:15000,timeout:15000});
 },[]);
 useEffect(()=>()=>{generation.current++;if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);},[]);
 return {position,status,error,locate};
}
