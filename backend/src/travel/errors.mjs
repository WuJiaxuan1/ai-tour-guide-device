export class TravelError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
export function check(ok, code, message, status = 400) { if (!ok) throw new TravelError(code, message, status); }
export function object(value, allowed) {
  check(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_INPUT', '请求必须是对象。');
  check(Object.keys(value).every(k => allowed.includes(k)), 'INVALID_INPUT', '请求包含未支持的字段。');
  return value;
}
export function text(value, name, max = 2000) {
  check(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'INVALID_INPUT', `${name}格式不正确。`);
  return value.trim();
}
export function idempotency(value) { return text(value, 'client_event_id', 100); }
