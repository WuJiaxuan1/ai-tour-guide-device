const TOKEN_KEY='qixia.demo-token';
const signature=value=>JSON.stringify(value);
const makeToken=()=>Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
export function snapshotFromTrip(trip){
  return {selectedPlaces:trip.selectedPlaces.map(p=>({id:p.id})),entryId:trip.entry?.id??null,
    exitId:trip.exit?.id??null,stayMinutes:trip.stayMinutes||{},focusedPlaceId:trip.focusedPlace?.id??null,
    recentQuestions:trip.recentQuestions||[]};
}
export function makeDemoSnapshot(route,messages,focusedPlaceId,read){
  const minutes=read('qixia.stay',{});
  return {selectedPlaces:route.map(id=>({id})),entryId:read('qixia.entry','gate'),exitId:read('qixia.exit','gate'),
    stayMinutes:Object.fromEntries(route.filter(id=>Number.isInteger(minutes?.[id])).map(id=>[id,minutes[id]])),
    focusedPlaceId:focusedPlaceId??null,recentQuestions:messages.filter(m=>m.role==='user').slice(-3).map(m=>String(m.content).trim()).filter(Boolean)};
}

// Mounted at app level: switching tabs must not stop synchronization.
export class DemoTripClient {
  constructor({fetcher=globalThis.fetch,storage=globalThis.sessionStorage,onChange=()=>{},tokenFactory=makeToken,debounceMs=300}={}){
    Object.assign(this,{fetcher,storage,onChange,tokenFactory,debounceMs});
    this.state={phase:'loading',trip:null,error:''};this.snapshot=null;this.token=null;this.disposed=false;
  }
  publish(patch){this.state={...this.state,...patch};if(!this.disposed)this.onChange(this.state);}
  async request(path,body){
    const headers={'X-Qixia-Demo':'1'};if(this.token)headers.Authorization='Bearer '+this.token;
    if(body!==undefined)headers['Content-Type']='application/json';
    let response,data;
    try {response=await this.fetcher('/api/demo-trip/'+path,{method:body===undefined?'GET':'POST',headers,
      cache:'no-store',signal:AbortSignal.timeout(6000),...(body!==undefined?{body:JSON.stringify(body)}:{})});data=await response.json();}
    catch {throw Error('无法连接本机服务，数据未确认同步。请重试。');}
    if(!response.ok){const e=Error(data.error||'演示服务请求失败。');e.status=response.status;throw e;}return data;
  }
  clearSession(){this.token=null;try{this.storage.removeItem(TOKEN_KEY);}catch{}this.saved=null;this.publish({phase:'idle',trip:null,error:''});}
  accept(trip){
    this.saved=signature(snapshotFromTrip(trip));this.publish({trip,error:'',phase:this.saved===signature(this.snapshot)?'synced':'syncing'});
  }
  async restore(){
    try {
      const status=await this.request('status');if(this.disposed)return;
      if(!status.enabled){this.publish({phase:'disabled'});return;}
      this.token=this.storage.getItem(TOKEN_KEY);
      if(!this.token){this.publish({phase:'idle'});return;}
      const trip=await this.request('session');if(this.disposed)return;
      this.accept(trip);await this.flush();
    }catch(e){if(this.disposed)return;if([401,404].includes(e.status))this.clearSession();
      else this.publish({phase:'error',error:e.message});}
  }
  setSnapshot(value){
    if(signature(value)===signature(this.snapshot))return;this.snapshot=value;
    if(!this.token||!this.state.trip||['ending','error'].includes(this.state.phase))return;
    this.publish({phase:'syncing'});clearTimeout(this.timer);
    this.timer=setTimeout(()=>this.flush(),this.debounceMs);
  }
  async start(){
    if(this.disposed||!this.snapshot||['starting','ending'].includes(this.state.phase))return;
    this.publish({phase:'starting',error:''});
    try {
      this.token=this.token||this.tokenFactory();
      // Persist before POST so a lost response can be recovered by the same owner.
      this.storage.setItem(TOKEN_KEY,this.token);
      const result=await this.request('start',this.snapshot);if(this.disposed)return;
      this.accept(result.trip);await this.flush();
    }catch(e){if(!this.disposed)this.publish({phase:'error',error:e.message});}
  }
  async flush(){
    clearTimeout(this.timer);
    if(this.pending)return this.pending;
    if(this.disposed||!this.token||!this.state.trip||this.state.phase==='ending')return;
    this.pending=(async()=>{
      try {
        let conflicts=0;
        while(!this.disposed&&this.state.phase!=='ending'&&this.saved!==signature(this.snapshot)){
          this.publish({phase:'syncing',error:''});const snapshot=this.snapshot;
          try {
            const result=await this.request('update',{...snapshot,expectedRevision:this.state.trip.revision});
            if(this.disposed||this.state.phase==='ending')return;this.accept(result.trip);conflicts=0;
          }catch(e){
            if(e.status===409&&conflicts++<1){
              const current=await this.request('session');if(this.disposed||this.state.phase==='ending')return;this.accept(current);continue;
            }throw e;
          }
        }
        if(!this.disposed&&this.state.phase!=='ending')this.publish({phase:'synced',error:''});
      }catch(e){
        if(this.disposed||this.state.phase==='ending')return;
        if([401,404].includes(e.status))this.clearSession();else this.publish({phase:'error',error:e.message});
      }
    })();
    try{await this.pending;}finally{this.pending=null;}
  }
  async end(){
    if(!this.token||this.disposed||['starting','ending'].includes(this.state.phase))return;
    clearTimeout(this.timer);this.publish({phase:'ending',error:''});
    await this.pending;
    try{await this.request('end',{});if(!this.disposed)this.clearSession();}
    catch(e){if(!this.disposed){if([401,404].includes(e.status))this.clearSession();else this.publish({phase:'error',error:e.message});}}
  }
  async retry(){
    if(this.disposed||this.pending||['starting','ending'].includes(this.state.phase))return;
    if(this.token){
      const token=this.token;
      try{const trip=await this.request('session');if(this.disposed||this.token!==token||this.state.phase==='ending')return;this.accept(trip);await this.flush();}
      catch(e){if(!this.disposed&&this.token===token&&this.state.phase!=='ending'){if([401,404].includes(e.status))this.clearSession();else this.publish({phase:'error',error:e.message});}}
    }else await this.restore();
  }
  async check(){
    if(!this.token||this.pending||this.disposed||this.state.phase!=='synced')return;
    try{const trip=await this.request('session');if(this.state.phase!=='synced'||this.disposed)return;this.accept(trip);await this.flush();}
    catch(e){if(this.state.phase==='synced'&&!this.disposed){if([401,404].includes(e.status))this.clearSession();else this.publish({phase:'error',error:e.message});}}
  }
  dispose(){this.disposed=true;clearTimeout(this.timer);}
}
