import {useEffect, useState} from 'react';
import {CloudSun, ChevronDown, RefreshCw} from 'lucide-react';

export default function WeatherStrip(){
  const [data,setData]=useState(null),[open,setOpen]=useState(false),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{const c=new AbortController();let active=true;const t=setTimeout(()=>c.abort(),12000);
    setError(false);fetch('/api/weather',{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();const d=await r.json();if(!d.live||!Array.isArray(d.forecasts))throw Error();if(active)setData(d);}).catch(()=>{if(active)setError(true);}).finally(()=>clearTimeout(t));
    return()=>{active=false;c.abort();clearTimeout(t);};},[retry]);
  const today=data?.forecasts?.[0];
  return <section className="weather-widget" aria-label="栖霞区天气">
    <button className="weather-strip" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>
      <CloudSun size={18}/><span>栖霞区 · {data?.live.weather||'今日天气'}</span>
      <strong>{today?`白天 ${today.dayTemperature}° · 夜间 ${today.nightTemperature}°`:error?'暂未获取':'正在获取'}</strong><ChevronDown size={13} className={open?'turned':''}/>
    </button>
    {open&&<div className="weather-detail">{data?<>
      <div className="weather-days">{data.forecasts.map(day=><div key={day.date}><small>{day.date.slice(5).replace('-','/')}</small><strong>{day.dayWeather}</strong><span>白天 {day.dayTemperature}°</span><span>夜间 {day.nightTemperature}°</span></div>)}</div>
      <p>{/雨|雪/.test(data.live.weather)?'雨雪天气山路易滑，出发前留意景区现场指引。':'山间体感与城区可能不同，出发前留意天气变化。'}</p>
      <small>栖霞区预报 · 更新于 {data.forecastReportTime||data.reportTime} · 高德天气</small>
    </>:<p>{error?'天气暂时未能获取，稍后可以重试。':'正在获取天气。'}</p>}
    {error&&<button className="weather-retry" onClick={()=>setRetry(v=>v+1)}><RefreshCw size={13}/>重新获取</button>}</div>}
  </section>;
}
