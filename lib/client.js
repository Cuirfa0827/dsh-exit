window.__ModuleLoader__.load({ id: "dsh-exit", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apply = apply;

/**
 * dsh-exit 浏览器半部：侧边栏底部「退出」按钮 + 现代化居中确认弹窗 +
 * 退出成功后的整页「已关闭」反馈。
 *
 * 注册到侧边栏外壳的 `sidebar.footer.action` 槽位（设置按钮正下方）。
 * 展开态显示「图标 + 退出」，56px 收起轨道下为圆形图标按钮。
 * 确认弹窗与「已关闭」页面均为自定义 React 组件，样式引用 DSH 主题
 * token（--dsw-alias-*），不再使用浏览器原生 confirm。
 */
const react = require("react");

const NS = "sidebar-exit";
const EXIT_URL = "/_dsh/exit";
const HEARTBEAT_INTERVAL_MS = 30000;

const CSS = '' +
  /* 侧边栏页脚按钮（紧凑：与设置按钮无缝衔接，间距 0） */
  '.dsx-layer{flex:none;align-items:center;width:100%;height:42px;display:flex;position:relative}' +
  '.dsx-layer.dsx-rail{width:36px;height:36px}' +
  '.dsx-badge{width:100%;height:42px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:transparent;border:none;border-radius:12px;align-items:center;gap:8px;margin:0 -2px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden}' +
  '.dsx-badge:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}' +
  '.dsx-badge:disabled{opacity:.5;cursor:default}' +
  '.dsx-layer.dsx-rail .dsx-badge{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;padding:0}' +
  '.dsx-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}' +
  /* 居中确认弹窗 */
  '.dsx-overlay{position:fixed;inset:0;z-index:9999;background:rgba(6,8,12,.45);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;font-family:var(--dsh-font-family,inherit)}' +
  '.dsx-dialog{width:380px;max-width:calc(100vw - 32px);background:var(--dsw-specific-menu,#fff);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:var(--dsw-shadow-lv3);padding:20px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box}' +
  '.dsx-dialog-title{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;margin:0}' +
  '.dsx-dialog-desc{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.6;margin:0}' +
  '.dsx-dialog-error{color:var(--dsw-alias-state-error-primary);font-size:12px;margin:0}' +
  '.dsx-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}' +
  '.dsx-btn{font-family:inherit;font-size:13px;padding:7px 16px;border-radius:9px;cursor:pointer;background:transparent;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}' +
  '.dsx-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}' +
  '.dsx-btn:disabled{opacity:.5;cursor:default}' +
  '.dsx-btn-danger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}' +
  '.dsx-btn-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}' +
  '.dsx-btn.dsx-btn-primary{background:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-label,#fff)}' +
  '.dsx-btn.dsx-btn-primary:hover:not(:disabled){background:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);filter:brightness(1.12)}' +
  '.dsx-btn.dsx-btn-primary:active:not(:disabled){filter:brightness(.94)}' +
  /* 退出成功后的整页反馈 */
  '.dsx-done{position:fixed;inset:0;z-index:9999;background:var(--dsw-specific-menu,#fff);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:var(--dsh-font-family,inherit)}' +
  '.dsx-done-icon{width:56px;height:56px;border-radius:50%;background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary);display:flex;align-items:center;justify-content:center}' +
  '.dsx-done-title{color:var(--dsw-alias-label-primary);font-size:17px;font-weight:600;margin:0}' +
  '.dsx-done-desc{color:var(--dsw-alias-label-secondary);font-size:13px;margin:0;text-align:center;line-height:1.6;max-width:340px}' +
  '.dsx-done-actions{display:flex;gap:8px;margin-top:6px}';

/** 电源图标（inline SVG，跟随 currentColor）。 */
function PowerIcon() {
  return react.createElement('svg', {
    width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true
  },
    react.createElement('path', { d: 'M8 1.8v6.4', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
    react.createElement('path', { d: 'M4.3 4.4a5 5 0 1 0 7.4 0', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' })
  );
}

/** 对勾图标（成功反馈用）。 */
function CheckIcon() {
  return react.createElement('svg', {
    width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true
  },
    react.createElement('path', { d: 'M5 12.5l4.5 4.5L19 7.5', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' })
  );
}

/**
 * 侧边栏页脚「退出」操作。
 * @param props - sidebar.footer.action 槽位 owner 共享：列状态。
 */
function ExitButton({ wide }) {
  const [phase, setPhase] = react.useState('idle'); // idle | confirm | closing | done | error
  const [error, setError] = react.useState(null);
  const busy = phase === 'closing';
  const layerRef = react.useRef(null);

  // 侧边栏外壳默认把 footer 动作区渲染在设置按钮上方。
  // 从本组件向上找到 footer 动作区容器（其父级是 flex column 且至少两个
  // 子元素的最近祖先，即 footArea），把它排到设置按钮下方（order: 2），
  // 并压紧高度/间距（外壳容器默认高 50px、内容居中留白），让两个按钮
  // 紧密相邻。宽屏 -4px、56px 轨道 -10px，随折叠状态联动。
  react.useEffect(() => {
    let el = layerRef.current?.parentElement;
    while (el) {
      const parent = el.parentElement;
      if (!parent) break;
      const style = getComputedStyle(parent);
      if (style.display === 'flex' && style.flexDirection === 'column' && parent.children.length >= 2) {
        el.style.order = '2';
        el.style.height = '42px';
        el.style.marginTop = wide ? '-4px' : '-10px';
        break;
      }
      el = parent;
    }
  }, [wide]);

  async function doShutdown() {
    if (busy) return;
    setPhase('closing');
    setError(null);
    try {
      const res = await fetch(EXIT_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'shutdown' }),
      });
      const body = await res.json();
      if (body && body.ok) {
        setPhase('done');
        // 尽力关闭当前窗口（脚本打开的窗口可关，普通标签页受浏览器限制）。
        window.setTimeout(() => {
          try { window.close(); } catch (e) { /* ignore */ }
        }, 800);
      } else {
        setPhase('error');
        setError(String((body && body.error) || '关机请求失败'));
      }
    } catch (e) {
      // 进程已退出导致 fetch 失败——这其实意味着关机成功。
      setPhase('done');
      window.setTimeout(() => {
        try { window.close(); } catch (e2) { /* ignore */ }
      }, 800);
    }
  }

  // —— 确认弹窗 ——
  if (phase === 'confirm') {
    return react.createElement('div', { className: 'dsx-overlay', onClick: () => setPhase('idle') },
      react.createElement('div', { className: 'dsx-dialog', onClick: (e) => e.stopPropagation() },
        react.createElement('p', { className: 'dsx-dialog-title' }, '关闭 DSH 服务'),
        react.createElement('p', { className: 'dsx-dialog-desc' }, '确定要关闭 DSH 服务吗？正在进行的对话将被中断。关闭后需要重新启动才能继续使用。'),
        error !== null && react.createElement('p', { className: 'dsx-dialog-error' }, '错误：' + error),
        react.createElement('div', { className: 'dsx-actions' },
          react.createElement('button', { type: 'button', className: 'dsx-btn', disabled: busy, onClick: () => setPhase('idle') }, '取消'),
          react.createElement('button', { type: 'button', className: 'dsx-btn dsx-btn-primary', disabled: busy, onClick: doShutdown }, busy ? '正在关闭…' : '确认关闭')
        )
      )
    );
  }

  // —— 退出成功后的整页反馈 ——
  if (phase === 'done') {
    return react.createElement('div', { className: 'dsx-done' },
      react.createElement('div', { className: 'dsx-done-icon' }, react.createElement(CheckIcon, null)),
      react.createElement('p', { className: 'dsx-done-title' }, '服务已关闭'),
      react.createElement('p', { className: 'dsx-done-desc' }, 'DSH 服务已优雅退出。此窗口现在可以安全关闭；需要再次使用时，重新运行 dsh web 即可。'),
      react.createElement('div', { className: 'dsx-done-actions' },
        react.createElement('button', {
          type: 'button', className: 'dsx-btn',
          onClick: () => { try { window.close(); } catch (e) { /* ignore */ } }
        }, '关闭此窗口')
      )
    );
  }

  // —— 侧边栏按钮（idle / closing / error 共用） ——
  return react.createElement('div', {
    ref: layerRef,
    className: wide ? 'dsx-layer' : 'dsx-layer dsx-rail'
  },
    react.createElement('button', {
      type: 'button',
      className: 'dsx-badge',
      'aria-label': '退出 DSH 服务',
      title: '关闭 DSH 服务进程',
      disabled: busy,
      onClick: () => {
        if (busy) return;
        if (phase === 'error') setError(null);
        setPhase('confirm');
      },
    },
      react.createElement(PowerIcon, null),
      wide && react.createElement('span', { className: 'dsx-label' }, '退出')
    )
  );
}

function apply(ctx) {
  // 注意：用 ctx.get('slots') 而非 ctx.slots —— slots 服务不要求声明注入，
  // 直接属性访问会被 cordis 的注入门禁拦截（与 dsh-shutdown 同款写法）。
  const slots = ctx.get('slots');
  if (slots === undefined) return;

  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-dsh-plugin', NS);
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  // —— 页面存活上报 ——
  // 关闭检测走 pagehide + sendBeacon（浏览器不节流、刷新/关窗必触发），
  // 心跳仅作崩溃兜底：30 秒一次 + 宿主 90 秒 TTL，足以容忍浏览器对
  // 后台标签页定时器的节流（最低 1 次/分钟），不会再把后台页面误判为关闭。
  const token = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
  const beat = () => {
    try {
      fetch(EXIT_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'hello', token }),
      }).catch(() => { /* 服务不可达：忽略 */ });
    } catch (e) { /* ignore */ }
  };
  const sendBye = () => {
    try {
      const payload = JSON.stringify({ action: 'bye', token });
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(EXIT_URL, new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(EXIT_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: payload,
        }).catch(() => { /* ignore */ });
      }
    } catch (e) { /* ignore */ }
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') beat(); // 从后台节流恢复后立即续命
  };
  beat();
  const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
  window.addEventListener('pagehide', sendBye);
  document.addEventListener('visibilitychange', onVisible);

  slots.inject('sidebar.footer.action', () => slots.register({
    name: 'sidebar.footer.action',
    id: NS,
  }, ExitButton));

  ctx.effect(() => () => {
    clearInterval(timer);
    window.removeEventListener('pagehide', sendBye);
    document.removeEventListener('visibilitychange', onVisible);
    if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  }, NS + ':lifecycle');
}

return module.exports; } });
