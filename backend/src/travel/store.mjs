import {DatabaseSync} from 'node:sqlite';
import {randomBytes, randomUUID, createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {check, idempotency} from './errors.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
export class TravelStore {
  constructor(path, {clock = () => Date.now()} = {}) {
    this.clock = clock;
    if (path !== ':memory:') mkdirSync(dirname(path), {recursive: true, mode: 0o700});
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, owner_id TEXT NOT NULL, kind TEXT NOT NULL, trip_id TEXT, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, version INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, seq INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(trip_id,seq));
      CREATE TABLE IF NOT EXISTS receipts (scope TEXT NOT NULL, request_id TEXT NOT NULL, digest TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(scope,request_id));
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, status TEXT NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS locations (trip_id TEXT PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS chats (owner_id TEXT NOT NULL, request_id TEXT NOT NULL, trip_id TEXT, conversation_id TEXT NOT NULL, digest TEXT NOT NULL, status TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(owner_id,request_id));
      PRAGMA user_version=1;`);
    this.db.exec("UPDATE chats SET status='failed' WHERE status='processing'; UPDATE jobs SET status='queued' WHERE status='running';");
  }
  close() { this.db.close(); }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  createSession({ownerId, tripId = null, kind = 'web', ttlMs = 7 * 86400000} = {}) {
    const token = randomBytes(32).toString('base64url'), id = randomUUID(), owner = ownerId || id;
    const expires = this.clock() + ttlMs;
    this.db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?,?)').run(id, hash(token), owner, kind, tripId, expires);
    return {token, session_id: id, kind, trip_id: tripId, expires_at: new Date(expires).toISOString()};
  }
  authenticate(token) {
    check(typeof token === 'string' && token.length >= 32, 'UNAUTHORIZED', '请先建立会话。', 401);
    const session = this.db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(hash(token));
    check(session && session.expires_at > this.clock(), 'UNAUTHORIZED', '会话已过期，请重新绑定。', 401);
    return session;
  }
  getTrip(session, id) {
    const row = this.db.prepare('SELECT * FROM trips WHERE id=?').get(id);
    check(row && row.owner_id === session.owner_id && (session.kind === 'web' || session.trip_id === id), 'NOT_FOUND', '没有找到可访问的旅行。', 404);
    return JSON.parse(row.body);
  }
  receipt(scope, requestId, input, fn) {
    idempotency(requestId);
    const digest = hash(JSON.stringify(input));
    const prior = this.db.prepare('SELECT * FROM receipts WHERE scope=? AND request_id=?').get(scope, requestId);
    if (prior) {
      check(prior.digest === digest, 'IDEMPOTENCY_CONFLICT', '同一请求标识不能用于不同操作。', 409);
      const response=JSON.parse(prior.response);check(!response.deleted,'TRIP_DELETED','这次行程已删除，请新建行程。',410);return response;
    }
    const response = fn();
    this.db.prepare('INSERT INTO receipts VALUES (?,?,?,?)').run(scope, requestId, digest, JSON.stringify(response));
    return response;
  }
  createTrip(session, input, create) {
    check(session.kind === 'web', 'FORBIDDEN', '设备不能创建旅行。', 403);
    return this.transaction(() => this.receipt('owner:' + session.owner_id, input.client_event_id, input, () => {
      const trip = {...create(), id: randomUUID(), version: 1, created_at: new Date(this.clock()).toISOString()};
      this.db.prepare('INSERT INTO trips VALUES (?,?,?,?)').run(trip.id, session.owner_id, trip.version, JSON.stringify(trip));
      this.appendEvent(trip.id, 'trip_planned', {route_id: trip.route.route_id}, session.kind);
      return trip;
    }));
  }
  mutate(session, id, input, fn) {
    this.getTrip(session, id);
    return this.transaction(() => this.receipt('trip:' + id, input.client_event_id, input, () => {
      const trip = this.getTrip(session, id);
      if (input.expected_version !== undefined) check(input.expected_version === trip.version, 'VERSION_CONFLICT', '旅行已更新，请重新读取状态。', 409);
      const changes = fn(trip) || [];
      trip.version++;
      trip.updated_at = new Date(this.clock()).toISOString();
      this.db.prepare('UPDATE trips SET version=?,body=? WHERE id=?').run(trip.version, JSON.stringify(trip), id);
      for (const change of changes) this.appendEvent(id, change.type, change.payload || {}, session.kind);
      return trip;
    }));
  }
  appendEvent(id, type, payload, source = 'backend') {
    const seq = this.db.prepare('SELECT COALESCE(MAX(seq),0)+1 AS n FROM events WHERE trip_id=?').get(id).n;
    const event = {event_id: randomUUID(), trip_id: id, server_seq: seq, type, payload, source, created_at: new Date(this.clock()).toISOString()};
    this.db.prepare('INSERT INTO events VALUES (?,?,?)').run(id, seq, JSON.stringify(event));
    return event;
  }
  events(session, id, after = 0) {
    this.getTrip(session, id);
    check(Number.isSafeInteger(after) && after >= 0, 'INVALID_INPUT', '事件序号不正确。');
    return this.db.prepare('SELECT body FROM events WHERE trip_id=? AND seq>? ORDER BY seq LIMIT 200').all(id, after).map(r => JSON.parse(r.body));
  }
  listTrips(session) {
    check(session.kind === 'web', 'FORBIDDEN', '设备只能访问已绑定旅行。', 403);
    return this.db.prepare('SELECT body FROM trips WHERE owner_id=? ORDER BY rowid DESC LIMIT 50').all(session.owner_id).map(r => JSON.parse(r.body));
  }
  location(session, id) {
    this.getTrip(session, id);
    const row = this.db.prepare('SELECT body FROM locations WHERE trip_id=?').get(id);
    return row ? JSON.parse(row.body) : null;
  }
  saveLocation(session, id, sample) {
    this.getTrip(session, id);
    return this.transaction(() => {
      const last = this.location(session, id);
      check(!last || sample.source_session_id === last.source_session_id, 'LOCATION_SOURCE_CONFLICT', '本旅行已由另一手机会话提供位置。', 409);
      check(!last || sample.client_seq > last.client_seq, 'STALE_LOCATION', '此定位更新已过期或重复。', 409);
      check(!last || Date.parse(sample.captured_at) >= Date.parse(last.captured_at), 'STALE_LOCATION', '不接受更早的定位。', 409);
      this.db.prepare('INSERT INTO locations VALUES (?,?) ON CONFLICT(trip_id) DO UPDATE SET body=excluded.body').run(id, JSON.stringify(sample));
      // Keep precise coordinates only in the current snapshot, never in historical event payloads.
      this.appendEvent(id, 'location_updated', {captured_at: sample.captured_at}, session.kind);
      return sample;
    });
  }
  beginChat(session, input) {
    idempotency(input.client_event_id);
    return this.transaction(() => {
      const old = this.db.prepare('SELECT * FROM chats WHERE owner_id=? AND request_id=?').get(session.owner_id, input.client_event_id);
      const digest = hash(JSON.stringify(input));
      if (old) {
        check(old.digest === digest, 'IDEMPOTENCY_CONFLICT', '请求标识已用于其他问题。', 409);
        check(old.status !== 'processing', 'REQUEST_PROCESSING', '这条问题仍在处理。', 409);
        if (old.status === 'completed') return {cached: JSON.parse(old.body).answer};
        this.db.prepare("UPDATE chats SET status='processing' WHERE owner_id=? AND request_id=?").run(session.owner_id,input.client_event_id);
        return {};
      }
      const body = {question: input.question, channel: session.kind, created_at: new Date(this.clock()).toISOString(), place_id: input.place_id || null};
      this.db.prepare('INSERT INTO chats VALUES (?,?,?,?,?,?,?)').run(session.owner_id,input.client_event_id,input.trip_id || null,input.conversation_id,digest,'processing',JSON.stringify(body));
      return {};
    });
  }
  finishChat(session, input, answer, status = 'completed') {
    const row=this.db.prepare('SELECT body FROM chats WHERE owner_id=? AND request_id=?').get(session.owner_id,input.client_event_id);
    const body={...JSON.parse(row.body),answer,completed_at:new Date(this.clock()).toISOString()};
    this.db.prepare('UPDATE chats SET status=?,body=? WHERE owner_id=? AND request_id=?').run(status,JSON.stringify(body),session.owner_id,input.client_event_id);
    if(input.trip_id)this.appendEvent(input.trip_id,status==='completed'?'voice_answer_ready':'answer_failed',{message_id:input.client_event_id,channel:session.kind},session.kind);
  }
  chatHistory(session, {conversationId, tripId} = {}) {
    if(session.kind==='device'){check(!tripId||tripId===session.trip_id,'FORBIDDEN','设备未绑定此旅行。',403);tripId=session.trip_id;}
    if(tripId)this.getTrip(session,tripId);
    const rows=tripId&&conversationId?this.db.prepare('SELECT request_id,status,body FROM chats WHERE owner_id=? AND trip_id=? AND conversation_id=? ORDER BY rowid DESC LIMIT 20').all(session.owner_id,tripId,conversationId):tripId?this.db.prepare('SELECT request_id,status,body FROM chats WHERE owner_id=? AND trip_id=? ORDER BY rowid DESC LIMIT 200').all(session.owner_id,tripId):this.db.prepare('SELECT request_id,status,body FROM chats WHERE owner_id=? AND conversation_id=? ORDER BY rowid DESC LIMIT 20').all(session.owner_id,conversationId);
    return rows.reverse().map(r=>({message_id:r.request_id,status:r.status,...JSON.parse(r.body)}));
  }
}
