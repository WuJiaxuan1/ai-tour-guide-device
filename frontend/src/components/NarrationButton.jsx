import {useEffect, useRef, useState} from 'react';
import {Headphones, Pause, LoaderCircle} from 'lucide-react';

export default function NarrationButton({place}) {
  const [state,setState] = useState('idle'), audio = useRef(null);
  useEffect(() => {
    const player = new Audio(place.audio);player.preload='none';audio.current=player;
    const playing=()=>setState('playing'), waiting=()=>setState('loading');
    const ended=()=>setState('idle'), paused=()=>{if(!player.ended)setState('paused');};
    const error=()=>setState('error');
    player.addEventListener('playing',playing);player.addEventListener('waiting',waiting);
    player.addEventListener('pause',paused);player.addEventListener('ended',ended);player.addEventListener('error',error);
    setState('idle');
    return()=>{player.removeEventListener('playing',playing);player.removeEventListener('waiting',waiting);player.removeEventListener('pause',paused);player.removeEventListener('ended',ended);player.removeEventListener('error',error);player.pause();player.removeAttribute('src');player.load();audio.current=null;};
  },[place.id,place.audio]);
  const toggle=()=>{
    const player=audio.current;if(!player)return;
    if(state==='playing'){player.pause();return;}
    if(state==='error')player.load();setState('loading');
    player.play().catch(()=>{if(audio.current===player)setState('error');});
  };
  return <><button className="secondary narration-button" onClick={toggle} disabled={state==='loading'} aria-pressed={state==='playing'}>
    {state==='playing'?<Pause size={16}/>:state==='loading'?<LoaderCircle size={16} className="spin"/>:<Headphones size={16}/>}
    <span>{state==='playing'?'暂停讲解':state==='paused'?'继续播放':state==='loading'?'正在加载':state==='error'?'重试播放':'听一听'}</span>
  </button>{state==='error'&&<p className="narration-error" role="alert">音频暂时未能播放，请重试；也可以继续阅读上方讲解。</p>}</>;
}
