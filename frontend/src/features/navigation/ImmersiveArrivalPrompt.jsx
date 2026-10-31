import {useState} from 'react';
import {travelRequest,requestId} from '../../services/travel-api';
import {TEMPLE_EXPERIENCE,eligibleImmersiveReminder} from '../../../../shared/immersive.mjs';
export default function ImmersiveArrivalPrompt({serverTrip,blocked,onOpen}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const {trip,navigation}=serverTrip;
 const reminder=eligibleImmersiveReminder(trip,navigation);
 if(blocked||!reminder)return null;
 const later=async()=>{setBusy(true);setError('');try{const latest=await travelRequest(`/trips/${trip.id}`);await travelRequest(`/trips/${trip.id}/immersive-reminder`,{method:'POST',body:{client_event_id:requestId(),expected_version:latest.version,reminder_id:reminder.id}});await serverTrip.refresh();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div className="overlay"><section className="modal utility-modal" role="dialog" aria-modal="true" aria-label="是否要进行沉浸式体验"><p className="eyebrow">你已接近栖霞寺</p><h2>是否要进行沉浸式体验？</h2><p>以明僧绍的视角走过一段山中人生。约三分钟，你的选择会留下不同的回响。</p>{error&&<p role="alert">{error}</p>}<button autoFocus className="primary" disabled={busy} onClick={async()=>{setBusy(true);try{await onOpen(TEMPLE_EXPERIENCE.id);}finally{setBusy(false);}}}>进入体验</button><button disabled={busy} onClick={later}>暂不体验</button><p>之后也可以点击栖霞寺或路线卡上的“沉浸式体验”标签进入。</p></section></div>;
}
