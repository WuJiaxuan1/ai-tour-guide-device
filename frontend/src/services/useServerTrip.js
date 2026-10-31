import {useCallback,useEffect,useRef,useState} from 'react';
import {activeTripId,setActiveTripId,travelRequest,requestId,subscribeTrip} from './travel-api';
export default function useServerTrip(visitor){
 const [trip,setTrip]=useState(null),[navigation,setNavigation]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[connected,setConnected]=useState(false);
 const tripRef=useRef(null),sequence=useRef(Date.now()),lastPosition=useRef(null),cursor=useRef(0),generation=useRef(0);
 const accept=useCallback(value=>{if(value&&tripRef.current?.id===value.id&&tripRef.current.version>value.version)return tripRef.current;if(tripRef.current?.id!==value?.id){generation.current++;setNavigation(null);lastPosition.current=null;}tripRef.current=value;setTrip(value);setActiveTripId(value?.id);return value;},[]);
 const acceptNavigation=useCallback(n=>{if(tripRef.current?.id!==n.trip_id)return;setNavigation(previous=>{if(previous?.trip_id===n.trip_id&&(previous.state_version>n.state_version||Date.parse(previous.location?.captured_at)>Date.parse(n.location?.captured_at)))return previous;return n;});},[]);
 const refresh=useCallback(async(id=tripRef.current?.id)=>{if(!id)return;const epoch=generation.current;try{const [t,n]=await Promise.all([travelRequest(`/trips/${id}`),travelRequest(`/trips/${id}/navigation-context`)]);if(generation.current!==epoch||tripRef.current?.id&&tripRef.current.id!==id)return;accept(t);acceptNavigation(n);}catch(e){if(generation.current===epoch&&['NOT_FOUND','UNAUTHORIZED'].includes(e.code))accept(null);throw e;}},[accept,acceptNavigation]);
 useEffect(()=>{let live=true;(async()=>{try{const id=activeTripId();if(id){const t=await travelRequest(`/trips/${id}`);if(live){accept(t);await refresh(id);}}}catch(e){if(live)setError(e.message);}finally{if(live)setLoading(false);}})();return()=>{live=false;};},[accept,refresh]);
 useEffect(()=>{if(!trip?.id)return;cursor.current=0;let cancelled=false,retry;const controller=new AbortController();
   const run=async()=>{try{await subscribeTrip(trip.id,cursor.current,event=>{cursor.current=Math.max(cursor.current,event.server_seq);refresh(trip.id).catch(e=>setError(e.message));},controller.signal,()=>{if(!cancelled)setConnected(true);});}catch(e){if(!cancelled)setError(e.message);}finally{if(!cancelled){setConnected(false);retry=setTimeout(run,3000);}}};run();return()=>{cancelled=true;controller.abort();clearTimeout(retry);};
 },[trip?.id,refresh]);
 useEffect(()=>{const p=visitor?.position;if(trip?.status!=='active'||!p?.rawLocation||lastPosition.current===p.at)return;lastPosition.current=p.at;let live=true;
 travelRequest(`/trips/${trip.id}/location`,{method:'POST',body:{client_seq:++sequence.current,captured_at:new Date(p.at).toISOString(),coordinate_system:'WGS84',location:p.rawLocation,accuracy_m:p.accuracy}}).then(n=>{if(live)acceptNavigation(n);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};
 },[trip?.id,trip?.status,visitor?.position]);
 // Refresh freshness even when the phone stops producing fixes.
 useEffect(()=>{if(!trip?.id)return;const timer=setInterval(()=>refresh().catch(()=>{}),30000);return()=>clearInterval(timer);},[trip?.id,refresh]);
 const choose=async(route,preferences)=>{setError('');const t=await travelRequest('/trips',{method:'POST',body:{client_event_id:requestId(),route_id:route.route_id,revision:route.revision,preferences}});accept(t);await refresh(t.id);return t;};
 const command=async(action,stop_id)=>{const t=tripRef.current;if(!t)return;setError('');try{const next=await travelRequest(`/trips/${t.id}/commands`,{method:'POST',body:{client_event_id:requestId(),expected_version:t.version,action,...(stop_id?{stop_id}:{})}});accept(next);await refresh(t.id);return next;}catch(e){setError(e.message);await refresh(t.id).catch(()=>{});throw e;}};
 const forget=useCallback(id=>{if(tripRef.current?.id===id){accept(null);setError('');setConnected(false);}},[accept]);
 return {trip,navigation,error,setError,loading,connected,choose,command,refresh,forget};
}
