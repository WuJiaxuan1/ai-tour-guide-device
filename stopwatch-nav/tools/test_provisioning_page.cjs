const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'firmware/components/78__esp-wifi-connect/assets/stopwatch_configuration_done.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function page(fetch) {
  const button = { disabled: false, textContent: '', addEventListener(event, callback) { this.click = callback; } };
  const status = { textContent: '' };
  const context = vm.createContext({ fetch, AbortController, setTimeout, clearTimeout,
    document: { getElementById: id => id === 'start' ? button : status } });
  vm.runInContext(script, context);
  return { button, status };
}
(async () => {
  let calls = 0;
  const success = page(async (url, opts) => {
    calls++; assert.equal(url, '/exit'); assert.equal(opts.method, 'POST');
    return { ok: true, json: async () => ({ success: true }) };
  });
  assert.equal(calls, 0, 'Page must not exit provisioning on load');
  await success.button.click();
  assert.equal(calls, 1); assert.equal(success.button.disabled, true);
  assert.match(success.status.textContent, /开启手机热点/);
  await success.button.click(); assert.equal(calls, 1, 'Duplicate clicks must not send another exit');
  const failed = page(async () => { throw new Error('network lost'); });
  await failed.button.click();
  assert.equal(failed.button.disabled, false);
  assert.match(failed.status.textContent, /尚未收到/);
  const rejected = page(async () => ({ ok: false }));
  await rejected.button.click(); assert.equal(rejected.button.disabled, false);
  console.log('PASS: page waits for explicit click; success shows hotspot handoff; duplicate click suppressed; network/error responses allow retry without claiming connected');
})().catch(error => { console.error(error); process.exitCode = 1; });
