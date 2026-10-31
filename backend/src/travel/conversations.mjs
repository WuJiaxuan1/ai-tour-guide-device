import {object,text,check} from './errors.mjs';
import {navigationIntent,navigationReply} from './navigation-replies.mjs';
export function createTravelConversation({store,navigation,knowledge,converse,model,dynamic}) {
  return async function answer(session,raw) {
    object(raw,['client_event_id','conversation_id','trip_id','question','place_id']);
    const input={...raw,question:text(raw.question,'问题',2000),conversation_id:text(raw.conversation_id,'会话标识',100)};
    if(session.kind==='device'){check(!input.trip_id||input.trip_id===session.trip_id,'FORBIDDEN','设备未绑定此旅行。',403);input.trip_id=session.trip_id;}
    const trip=input.trip_id?store.getTrip(session,input.trip_id):null;
    if(input.place_id)check(knowledge?.publicPoi(input.place_id),'UNKNOWN_PLACE','未找到这个景点。',404);
    const prior=store.beginChat(session,input);if(prior.cached)return prior.cached;
    try {
      const history=store.chatHistory(session,{conversationId:input.conversation_id,tripId:input.trip_id}).filter(m=>m.status==='completed').flatMap(m=>[{role:'user',content:m.question},{role:'assistant',content:m.answer.reply}]);
      const nav=trip?navigation.context(session,trip.id):null;
      let reply,sourceIds=[],placeIds=[],unknown=false,mode='knowledge',extra={};
      const intent=navigationIntent(input.question);
      if(/沉浸|人物视角|互动体验/.test(input.question)){reply='当前栖霞寺提供沉浸式体验《我把家，留给了这座山》，你可以点击网页栖霞寺景点卡或包含栖霞寺的路线卡上的“沉浸式体验”标签进入。';mode='navigation';}
      else if(intent){
        reply=navigationReply(nav,intent);mode='navigation';
        if(intent==='next_leg'&&nav?.status==='active'){
          const target=input.question.match(/到(.+?)(?:还|大概|大约|要|需|有|多远|多久|距离|几|多少|[？?，,。]|$)/)?.[1]?.trim();
          if(target&&!/下一站|下个景点/.test(target)&&target!==nav.next_stop?.name)reply=`当前仅估算下一站${nav.next_stop?.name||'（暂无）'}，没有计算到${target}的道路时间。请询问“到下一站还有多远”，或查看网页地图。`;
        }
      }
      else if(/现在|今天|近期|本周/.test(input.question)&&/枫|红叶|活动/.test(input.question)){
        const info=dynamic?.query(/活动/.test(input.question)?'activities':'maple');extra.dynamic=info;unknown=!info?.items.length;reply=unknown?'暂时没有有效期内、已核验的近期资料，请查看景区公告。':info.items.map(i=>i.report_text||i.title).join('\n');sourceIds=info?.items.map(i=>i.source_ref)||[];
      } else {
        let place=input.place_id;
        if(!place&&/这里|此处|现在的景点/.test(input.question))place=nav?.current_place?.attraction_id;
        if(!place&&/这里|此处|现在的景点/.test(input.question)){reply='暂不能确认你指的是哪个景点。请告诉我景点名称，或在网页中选择景点。';unknown=true;}
        else {
          const evidence=await converse({messages:[...history.slice(-18),{role:'user',content:input.question}],context:{currentPlaceId:place,location:nav?.location.freshness==='fresh'?[nav.location.longitude,nav.location.latitude]:undefined}});
          const poi=place?knowledge.publicPoi(place):null;
          reply=poi?`${poi.name}\n${poi.narration}\n${poi.explanation||''}`:evidence.reply;sourceIds=poi?[poi.id]:evidence.sourceIds||[];placeIds=poi?[poi.id]:evidence.placeIds||[];unknown=evidence.unknown===true;
          if(model.configured()&&sourceIds.length){const generated=await model.generate({purpose:'answer',question:input.question,context:{knowledge:reply,source_ids:sourceIds,trip_status:nav?{status:nav.status,next_stop:nav.next_stop?.name,location_freshness:nav.location.freshness}:null},history});reply=generated.text;mode='grounded-model';extra.model=generated.model;}
        }
      }
      if(['location','next_stop','next_leg'].includes(intent)&&nav?.immersive_hint&&!/沉浸|人物视角|互动体验/.test(input.question))reply+=' '+nav.immersive_hint;
      const result={reply,placeIds,sourceIds,unknown,mode,model_status:model.configured()?'configured':'unconfigured',...extra};
      store.finishChat(session,input,result);return result;
    } catch(error){store.finishChat(session,input,{error_code:error.code||'UPSTREAM_UNAVAILABLE'},'failed');throw error;}
  };
}
