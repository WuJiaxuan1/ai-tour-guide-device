import {resolve} from 'node:path';
import {TravelStore} from './store.mjs';
import {createTripService} from './trips.mjs';
import {recommend} from './planner.mjs';
import {TravelError, check, object} from './errors.mjs';
import {createNavigationService} from './navigation.mjs';
import {createTextModel,modelConfig} from './text-model.mjs';
import {createTravelConversation} from './conversations.mjs';
import {createDynamicInfo} from './dynamic.mjs';
import {createMemoryService} from './memory.mjs';
import {createImmersiveService} from './immersive.mjs';
import {randomUUID} from 'node:crypto';
import {createPairing} from './pairing.mjs';
import {validateTool} from '../../integrations/xiaozhi/bridge-tools.mjs';
import {createTripDeletion} from './deletion.mjs';
import {createPhotoService} from './photos.mjs';

export async function readJSON(req, limit = 65536) {
  check((req.headers['content-type'] || '').split(';')[0] === 'application/json', 'INVALID_CONTENT_TYPE', '请提交 JSON。', 415);
  const chunks = []; let length = 0;
  for await (const chunk of req) { length += chunk.length; check(length <= limit, 'TOO_LARGE', '请求内容过大。', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new TravelError('INVALID_JSON', 'JSON 格式不正确。'); }
}
export function sendJSON(res, status, value) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(JSON.stringify(value));
}
export function createTravelApi({root, presets, convertLocation, walkingLeg, reverseGeocode, knowledge, converse, catalog = [], model = createTextModel({config:()=>modelConfig(root)}), store = new TravelStore(resolve(root, '.local-work/travel.sqlite'))}) {
  const trips = createTripService(store, presets.data || presets);
  const data = presets.data || presets;
  const immersive = createImmersiveService({root,store});
  const navigation = createNavigationService({store, convertLocation, walkingLeg,reverseGeocode,onProximity:immersive.onProximity});
  const dynamic = createDynamicInfo(root,store.clock);
  const answer = createTravelConversation({store,navigation,knowledge,converse,model,dynamic});
  const pairing=createPairing({store,secret:()=>modelConfig(root).mcpSecret});
  const deletion=createTripDeletion({store,root});
  const photos=createPhotoService({store,root});
  const memory = createMemoryService({store,root,model,scenicIds:new Set(catalog.filter(p=>p.kind!=='facility'&&!p.tags?.includes('出入口')&&!p.tags?.includes('服务')).map(p=>p.id)),config:()=>modelConfig(root)});
  queueMicrotask(()=>memory.drain());
  async function handle(req, res, url) {
    if (!url.pathname.startsWith('/api/v1/')) return false;
    try {
      const path = url.pathname.slice('/api/v1'.length), method = req.method;
      if (path === '/sessions' && method === 'POST') { sendJSON(res, 201, store.createSession()); return true; }
      const token = /^Bearer ([A-Za-z0-9_-]+)$/.exec(req.headers.authorization || '')?.[1];
      if(path==='/bridge/tools'&&method==='POST'){
        pairing.authorize(token);const input=await readJSON(req);object(input,['name','arguments']);const args=input.arguments||{};try{validateTool(input.name,args);}catch{throw new TravelError('INVALID_TOOL_INPUT','工具名称或参数无效。');}
        let result;
        if(input.name==='qixia_pairing_code')result=pairing.issue();
        else {const device=pairing.session(),id=device.trip_id;
          if(input.name==='qixia_trip_context')result=navigation.context(device,id);
          else if(input.name==='qixia_trip_ask')result=await answer(device,{...args,trip_id:id,conversation_id:'xiaozhi:'+id,client_event_id:randomUUID()});
          else if(input.name==='qixia_trip_note'){check(!args.attraction_id||knowledge?.publicPoi(args.attraction_id),'UNKNOWN_PLACE','景点不存在。',404);result=store.mutate(device,id,{client_event_id:randomUUID()},t=>{const note={id:randomUUID(),text:args.text,attraction_id:args.attraction_id||null,source:'device',created_at:new Date(store.clock()).toISOString()};t.notes.push(note);return[{type:'note_saved',payload:{note_id:note.id}}];});result={saved:true};}
          else {const trip=store.getTrip(device,id);result=trips.command(device,id,{client_event_id:randomUUID(),expected_version:trip.version,action:'confirm_visit',stop_id:args.stop_id});result={confirmed:true,next_stop:navigation.context(device,id).next_stop};}
        }
        sendJSON(res,200,result);return true;
      }
      const session = store.authenticate(token);
      if(path==='/photos'||path.startsWith('/photos/')){
        check(method!=='POST','PHOTO_CREATION_DISABLED','照片创作已恢复为本地手账演示，服务器制作已停用。',410);
        if(path==='/photos'&&method==='GET')sendJSON(res,200,{photos:photos.list(session)});
        else if(path==='/photos'&&method==='POST'){
          check(session.kind==='web','FORBIDDEN','照片创作请在网页操作。',403);
          const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;check(size<=8*1024*1024,'TOO_LARGE','请选择不超过8 MB的照片。',413);chunks.push(chunk);}
          sendJSON(res,201,await photos.upload(session,Buffer.concat(chunks),(req.headers['content-type']||'').split(';')[0],req.headers['x-client-event-id']));
        }else{
          const match=/^\/photos\/([a-f0-9-]{36})(?:\/(generate|assets\/(?:original|memory_card|transparent_stickers)))?$/.exec(path);
          check(match,'NOT_FOUND','接口不存在。',404);const [,id,action='']=match;
          if(!action&&method==='GET')sendJSON(res,200,photos.get(session,id));
          else if(!action&&method==='DELETE')sendJSON(res,200,photos.remove(session,id,await readJSON(req)));
          else if(action==='generate'&&method==='POST')sendJSON(res,202,photos.generate(session,id,await readJSON(req)));
          else if(action.startsWith('assets/')&&method==='GET'){
            const asset=photos.asset(session,id,action.split('/')[1]);res.writeHead(200,{'Content-Type':asset.mime_type,'Content-Disposition':`attachment; filename="${asset.filename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(asset.bytes);
          }else check(false,'NOT_FOUND','接口不存在。',404);
        }return true;
      }
      if (path === '/capabilities' && method === 'GET') sendJSON(res,200,{schema_version:'1.0',persistent_trips:true,text_model_configured:model.configured(),proactive_device_speech:false,full_voice_transcript_capture:false,sticker_generation_configured:Boolean(modelConfig(root).imageEndpoint),photo_craft_available:false,photo_craft_independent:true,photo_craft_mode:'local_demo'});
      else if (path === '/chat' && method === 'POST') sendJSON(res,200,await answer(session,await readJSON(req)));
      else if (path === '/conditions/maple' && method === 'GET') sendJSON(res,200,dynamic.query('maple'));
      else if (path === '/activities' && method === 'GET') sendJSON(res,200,dynamic.query('activities'));
      else if (path === '/experiences' && method === 'GET') sendJSON(res,200,{experiences:immersive.list()});
      else if (/^\/experiences\/[a-z0-9-]+$/.test(path) && method === 'GET') sendJSON(res,200,immersive.get(path.split('/').at(-1)));
      else if (path === '/planner/recommend' && method === 'POST') sendJSON(res, 200, recommend(data, await readJSON(req)));
      else if (path === '/trips' && method === 'POST') sendJSON(res, 201, trips.create(session, await readJSON(req)));
      else if (path === '/trips' && method === 'GET') sendJSON(res, 200, {trips: store.listTrips(session)});
      else {
        const match = /^\/trips\/([a-f0-9-]{36})(?:\/(.*))?$/.exec(path);
        check(match, 'NOT_FOUND', '接口不存在。', 404);
        const [, id, action = ''] = match;
        store.getTrip(session, id);
        if (!action && method === 'GET') sendJSON(res, 200, store.getTrip(session, id));
        else if(!action&&method==='DELETE')sendJSON(res,200,deletion.remove(session,id,await readJSON(req)));
        else if(action==='pair-device'&&method==='POST')sendJSON(res,200,pairing.bind(session,id,await readJSON(req)));
        else if (action === 'commands' && method === 'POST') sendJSON(res, 200, trips.command(session, id, await readJSON(req)));
        else if (action === 'location' && method === 'POST') sendJSON(res, 200, await navigation.update(session, id, await readJSON(req)));
        else if (action === 'navigation-context' && method === 'GET') sendJSON(res, 200, navigation.context(session, id));
        else if (action === 'interactions' && method === 'GET') sendJSON(res,200,{interactions:store.chatHistory(session,{tripId:id})});
        else if (action === 'immersive' && method === 'POST') sendJSON(res,200,immersive.command(session,id,await readJSON(req)));
        else if (action === 'immersive-reminder' && method === 'POST') sendJSON(res,200,immersive.dismiss(session,id,await readJSON(req)));
        else if (action === 'memory' && method === 'GET') sendJSON(res,200,{facts:memory.facts(session,id),jobs:memory.list(session,id),notes:store.getTrip(session,id).notes||[],interactions:store.chatHistory(session,{tripId:id}).slice(-20)});
        else if (action === 'jobs' && method === 'POST') sendJSON(res,202,memory.generate(session,id,await readJSON(req)));
        else if (/^jobs\/[a-f0-9-]{36}$/.test(action) && method === 'GET') sendJSON(res,200,memory.get(session,id,action.split('/')[1]));
        else if (action === 'media' && method === 'POST') {
          const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;check(size<=8*1024*1024,'TOO_LARGE','照片请限制在 8 MB 内。',413);chunks.push(chunk);}
          sendJSON(res,201,memory.upload(session,id,Buffer.concat(chunks),(req.headers['content-type']||'').split(';')[0],url.searchParams.get('attraction_id')));
        }
        else if (/^assets\/[a-f0-9-]{36}$/.test(action) && method === 'GET') {
          check(session.kind==='web','FORBIDDEN','请从网页下载照片资产。',403);
          const asset=memory.asset(session,id,action.split('/')[1]);res.writeHead(200,{'Content-Type':asset.mime_type,'Content-Disposition':`attachment; filename="${asset.filename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(asset.bytes);
        }
        else if (action === 'notes' && method === 'POST') {
          const input=await readJSON(req);object(input,['text','attraction_id','expected_version','client_event_id']);check(typeof input.text==='string'&&input.text.trim()&&input.text.length<=4000,'INVALID_INPUT','笔记内容无效。');
          check(!input.attraction_id||knowledge?.publicPoi(input.attraction_id),'UNKNOWN_PLACE','笔记景点不存在。',404);
          sendJSON(res,201,store.mutate(session,id,input,trip=>{trip.notes.push({id:input.client_event_id,text:input.text.trim(),attraction_id:input.attraction_id||null,source:session.kind,created_at:new Date(store.clock()).toISOString()});return [{type:'note_saved',payload:{note_id:input.client_event_id}}];}));
        }
        else if (action === 'events' && method === 'GET') sendJSON(res, 200, {events: store.events(session, id, Number(url.searchParams.get('after') || 0))});
        else if (action === 'device-binding' && method === 'POST') {
          check(session.kind === 'web', 'FORBIDDEN', '请在网页绑定设备。', 403);
          sendJSON(res, 201, store.createSession({ownerId: session.owner_id, tripId: id, kind: 'device', ttlMs: 12 * 3600000}));
        }
        else if (action === 'events/stream' && method === 'GET') {
          let after = Number(url.searchParams.get('after') || 0);
          store.events(session, id, after);
          res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-store', 'X-Accel-Buffering': 'no'});
          const tick = () => {
            if (session.expires_at <= store.clock()) { res.end(); return; }
            try { for (const event of store.events(session, id, after)) { res.write(`id: ${event.server_seq}\ndata: ${JSON.stringify(event)}\n\n`); after = event.server_seq; } res.write(': heartbeat\n\n'); }
            catch { res.end(); }
          };
          tick(); const timer = setInterval(tick, 1500); timer.unref(); res.on('close', () => clearInterval(timer));
        }
        else check(false, 'NOT_FOUND', '接口不存在。', 404);
      }
    } catch (error) {
      if (!res.headersSent) sendJSON(res, error instanceof TravelError ? error.status : 500, {error: {code: error instanceof TravelError ? error.code : 'INTERNAL_ERROR', message: error instanceof TravelError ? error.message : '服务暂时无法完成请求。'}});
      else res.end();
    }
    return true;
  }
  return {handle, store, close: async () => {deletion.close();await photos.close();await memory.close();store.close();}};
}
