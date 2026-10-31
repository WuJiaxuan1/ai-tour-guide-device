import {check, object} from './errors.mjs';
import {recommend} from './planner.mjs';

export function createTripService(store, presets) {
  const create = (session, input) => {
    object(input, ['client_event_id', 'preferences', 'route_id', 'revision']);
    return store.createTrip(session, input, () => {
    const found = recommend(presets, input.preferences).routes.find(r => r.route_id === input.route_id);
    check(found, 'ROUTE_NOT_ELIGIBLE', '这条路线不符合所选条件。', 422);
    check(found.revision === input.revision, 'ROUTE_VERSION_CHANGED', '路线资料已更新，请重新选择。', 409);
    return {status: 'planned', preferences: input.preferences, route: found, started_at: null, ended_at: null, paused_at: null, paused_ms: 0, visits: [], interactions: [], notes: [], location: null, reminders: [], immersive_sessions: [], media: []};});
  };
  const command = (session, id, input) => {
    object(input, ['client_event_id', 'expected_version', 'action', 'stop_id']);
    check(Number.isInteger(input.expected_version), 'INVALID_INPUT', '请提供读取到的旅行版本。');
    return store.mutate(session, id, input, trip => {
      const now = new Date(store.clock()).toISOString();
      const a = input.action;
      if (a === 'start') { check(trip.status === 'planned' && trip.route.navigation_ready, 'NOT_NAVIGABLE', '当前旅行或道路资料尚不能开始导航。', 409); trip.status = 'active'; trip.started_at = now; trip.location_required_after = now; }
      else if (a === 'pause') { check(trip.status === 'active', 'INVALID_STATE', '当前不能暂停。', 409); trip.status = 'paused'; trip.paused_at = now; }
      else if (a === 'resume') { check(trip.status === 'paused', 'INVALID_STATE', '当前不能恢复。', 409); trip.paused_ms += store.clock() - Date.parse(trip.paused_at); trip.paused_at = null; trip.status = 'active'; trip.location_required_after = now; }
      else if (a === 'complete') { check(['active', 'paused'].includes(trip.status), 'INVALID_STATE', '当前不能结束旅行。', 409); if (trip.paused_at) trip.paused_ms += store.clock() - Date.parse(trip.paused_at); trip.paused_at = null; trip.ended_at = now; trip.status = 'completed'; }
      else if (['confirm_visit', 'skip_stop'].includes(a)) {
        check(trip.status === 'active', 'INVALID_STATE', '请先开始或恢复旅行。', 409);
        const stop = trip.route.stops.find(s => s.stop_id === input.stop_id);
        check(stop && stop.status === 'pending', 'INVALID_STOP', '停靠不存在或已处理。', 409);
        stop.status = a === 'confirm_visit' ? 'visited' : 'skipped';
        if (a === 'confirm_visit') trip.visits.push({stop_id: stop.stop_id, attraction_id: stop.attraction_id, confirmed_at: now, source: session.kind});
      } else check(false, 'INVALID_ACTION', '不支持这个旅行操作。');
      return [{type: a === 'confirm_visit' ? 'visit_confirmed' : a === 'skip_stop' ? 'stop_skipped' : 'trip_' + ({start: 'started', pause: 'paused', resume: 'resumed', complete: 'completed'}[a]), payload: {stop_id: input.stop_id || null, status: trip.status}}];
    });
  };
  return {create, command};
}
