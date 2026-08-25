// dsh-exit 宿主逻辑单测：验证 bye 宽限 / 刷新取消 / 功能关闭等场景。
// 运行：node test/host-logic.mjs
import { apply } from '../lib/index.js';

let exited = false;
const origExit = process.exit;
process.exit = (code) => { exited = true; };

const routes = [];
const disposers = [];
function makeCtx(config) {
  const ctx = {
    inject(names, cb) {
      const webCtx = { webServer: { register(route) { routes.push(route); return () => {}; } } };
      const ret = cb(webCtx);
      if (typeof ret === 'function') disposers.push(ret);
    },
    effect(cb) { const d = cb(); if (typeof d === 'function') disposers.push(d); },
  };
  return ctx;
}

function makeReq(body, { method = 'POST', origin, host } = {}) {
  const listeners = {};
  const req = {
    method,
    headers: { ...(origin ? { origin } : {}), ...(host ? { host } : {}) },
    on(ev, cb) { (listeners[ev] ||= []).push(cb); return req; },
  };
  return { req, fire() { for (const cb of listeners.data || []) cb(body); for (const cb of listeners.end || []) cb(); } };
}

function makeRes() {
  const r = { statusCode: 0, headers: {}, body: '' };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (p) => { r.body = p; };
  return r;
}

async function post(handler, action, token, { origin, host } = {}) {
  const { req, fire } = makeReq(JSON.stringify({ action, token }), { origin, host });
  const res = makeRes();
  await handler(req, res);
  fire();
  await new Promise((r) => setTimeout(r, 20));
  return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = () => routes[0].handler;

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗ FAIL:', name); }
}

// ---------- 场景 1：功能关闭（exitOnWindowClose: false）----------
console.log('\n[1] exitOnWindowClose=false：bye 后不退出');
exited = false;
routes.length = 0;
await apply(makeCtx({ exitOnWindowClose: false }), { exitOnWindowClose: false });
await post(H(), 'hello', 't1');
await post(H(), 'bye', 't1');
await sleep(4000); // 超过宽限期
check('bye 后 4s 未退出', !exited);
check('hello 响应带 exitOnWindowClose:false', (await post(H(), 'hello', 't2')).body.exitOnWindowClose === false);
check('非回环 Origin 被拒 403', (await post(H(), 'shutdown', null, { origin: 'https://evil.com' })).status === 403);

// ---------- 场景 2：功能开启 + 刷新取消 ----------
console.log('\n[2] exitOnWindowClose=true：刷新（bye 后宽限期内新 hello）不退出');
exited = false;
routes.length = 0;
await apply(makeCtx({ exitOnWindowClose: true }), { exitOnWindowClose: true });
await post(H(), 'hello', 'a');
await post(H(), 'bye', 'a');       // 页面关闭（刷新）
await sleep(1000);
await post(H(), 'hello', 'b');     // 新页面在宽限期内重新注册
await sleep(4000);                 // 超过宽限期
check('刷新场景未退出', !exited);

// ---------- 场景 3：功能开启 + 真正关闭 ----------
console.log('\n[3] exitOnWindowClose=true：bye 后无新页面 → 退出');
exited = false;
routes.length = 0;
await apply(makeCtx({ exitOnWindowClose: true }), { exitOnWindowClose: true });
await post(H(), 'hello', 'a');
await post(H(), 'bye', 'a');       // 最后一个页面关闭
await sleep(6000);                 // 宽限 5s + 退出延迟 0.5s + 余量
check('真正关闭后退出', exited);

// ---------- 场景 4：启动后无页面不自杀 ----------
console.log('\n[4] 启动后从未有页面：不退出（hasSeenPage 护栏）');
exited = false;
routes.length = 0;
await apply(makeCtx({ exitOnWindowClose: true }), { exitOnWindowClose: true });
await sleep(5500);
check('无页面时未退出', !exited);

// ---------- 场景 5：多窗口 ----------
console.log('\n[5] 多窗口：关一个不退出，关最后一个退出');
exited = false;
routes.length = 0;
await apply(makeCtx({ exitOnWindowClose: true }), { exitOnWindowClose: true });
await post(H(), 'hello', 'w1');
await post(H(), 'hello', 'w2');
await post(H(), 'bye', 'w1');
await sleep(6000);
check('关掉一个窗口未退出', !exited);
await post(H(), 'bye', 'w2');
await sleep(6000);
check('关掉最后一个窗口退出', exited);

process.exit = origExit;
console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
