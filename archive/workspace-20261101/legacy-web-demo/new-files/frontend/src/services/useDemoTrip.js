import {useEffect,useRef,useState} from 'react';
import {DemoTripClient,makeDemoSnapshot} from './demo-trip';
import {readJourney} from './journey';

export default function useDemoTrip(route,focusedPlaceId){
  const client=useRef(null),latest=useRef(null);
  const [state,setState]=useState({phase:'loading',trip:null,error:''}),[change,setChange]=useState(0);
  const [questions,setQuestions]=useState(()=>{try{const value=JSON.parse(sessionStorage.getItem('qixia.demo-questions')||'[]');return Array.isArray(value)?value.filter(q=>typeof q==='string').slice(-3):[];}catch{return [];}});
  const snapshot=makeDemoSnapshot(route,questions.map(content=>({role:'user',content})),focusedPlaceId,readJourney);latest.current=snapshot;
  const key=JSON.stringify(snapshot);
  useEffect(()=>{
    const instance=new DemoTripClient({onChange:setState});client.current=instance;instance.setSnapshot(latest.current);instance.restore();
    const refresh=()=>setChange(n=>n+1),check=()=>{if(document.visibilityState==='visible')instance.check();};
    window.addEventListener('qixia-journey-change',refresh);window.addEventListener('storage',refresh);
    document.addEventListener('visibilitychange',check);const timer=setInterval(check,15000);
    return()=>{instance.dispose();clearInterval(timer);window.removeEventListener('qixia-journey-change',refresh);
      window.removeEventListener('storage',refresh);document.removeEventListener('visibilitychange',check);};
  },[]);
  useEffect(()=>{client.current?.setSnapshot(latest.current);},[key,change]);
  const recordQuestion=value=>setQuestions(old=>{const next=[...old,String(value).trim()].slice(-3);try{sessionStorage.setItem('qixia.demo-questions',JSON.stringify(next));}catch{}return next;});
  const end=async()=>{await client.current?.end();if(client.current?.state.phase==='idle'){setQuestions([]);try{sessionStorage.removeItem('qixia.demo-questions');}catch{}}};
  return {...state,recordQuestion,start:()=>client.current?.start(),end,retry:()=>client.current?.retry()};
}
