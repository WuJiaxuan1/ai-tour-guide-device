// Acknowledge a committed choice before background navigation refreshes finish.
export async function saveImmersiveAction(request,trip,input,isCurrent=()=>true){
 if(!isCurrent())throw Error('当前行程已切换，请关闭体验后重新打开。');
 const send=t=>request(`/trips/${t.id}/immersive`,{method:'POST',body:{...input,expected_version:t.version}});
 try{return await send(trip);}
 catch(error){
  if(error.code!=='VERSION_CONFLICT')throw error;
  const latest=await request(`/trips/${trip.id}`);
  if(!isCurrent())throw Error('当前行程已切换，请关闭体验后重新打开。');
  return send(latest);
 }
}
