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
 *
 * 增强（0.4.0）：
 *   - 弹窗键盘 + 焦点管理（Enter 确认 / Esc 取消 / 焦点陷阱 / 还原）；
 *   - i18n：走 DSH locale 系统（zh/en），register locale 选项触发框架注入 t；
 *   - 进行中任务感知：检测当前 session 的 running 状态，弹窗描述动态切换；
 *   - 关窗失败自适应：window.close() 在普通标签页会静默失败，检测后改文案。
 */
const react = require("react");

const NS = "sidebar-exit";
const NS_LOCALE = "dsh-exit";
const EXIT_URL = "/_dsh/exit";
const HEARTBEAT_INTERVAL_MS = 30000;

const CSS = '' +
  /* 侧边栏页脚按钮（紧凑：与设置按钮无缝衔接，间距 0） */
  '.dsx-layer{flex:none;align-items:center;width:100%;height:42px;display:flex;position:relative}' +
  '.dsx-layer.dsx-rail{width:36px;height:36px}' +
  '.dsx-badge{width:100%;height:42px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:transparent;border:none;border-radius:12px;align-items:center;gap:8px;margin:0 -2px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden}' +
  '.dsx-badge:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}' +
  '.dsx-badge:disabled{opacity:.5;cursor:default}' +
  '.dsx-badge:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}' +
  '.dsx-layer.dsx-rail .dsx-badge{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;padding:0}' +
  '.dsx-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}' +
  /* 居中确认弹窗 */
  '.dsx-overlay{position:fixed;inset:0;z-index:9999;background:rgba(6,8,12,.45);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;font-family:var(--dsh-font-family,inherit)}' +
  '.dsx-dialog{width:380px;max-width:calc(100vw - 32px);background:var(--dsw-specific-menu,#fff);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:var(--dsw-shadow-lv3);padding:20px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box}' +
  '.dsx-dialog-title{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;margin:0}' +
  '.dsx-dialog-desc{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.6;margin:0}' +
  '.dsx-dialog-busy{color:var(--dsw-alias-state-warn-label);font-size:12px;margin:0;font-weight:500}' +
  '.dsx-dialog-error{color:var(--dsw-alias-state-error-primary);font-size:12px;margin:0}' +
  '.dsx-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}' +
  '.dsx-btn{font-family:inherit;font-size:13px;padding:7px 16px;border-radius:9px;cursor:pointer;background:transparent;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}' +
  '.dsx-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}' +
  '.dsx-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}' +
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

// —— i18n 字典 ——
const DICT_ZH = {
  'button.label': '退出',
  'button.aria': '退出 DSH 服务',
  'button.title': '关闭 DSH 服务进程',
  'modal.title': '关闭 DSH 服务',
  'modal.desc': '确定要关闭 DSH 服务吗？正在进行的对话将被中断。关闭后需要重新启动才能继续使用。',
  'modal.desc.busy': '检测到当前有对话正在进行，退出将中断它。确定要关闭 DSH 服务吗？',
  'modal.cancel': '取消',
  'modal.confirm': '确认关闭',
  'modal.confirming': '正在关闭…',
  'modal.error': '错误：{error}',
  'done.title': '服务已关闭',
  'done.desc': 'DSH 服务已优雅退出。此窗口现在可以安全关闭；需要再次使用时，重新运行 dsh web 即可。',
  'done.desc.unclosed': 'DSH 服务已优雅退出。此标签页现在可以手动关闭；需要再次使用时，重新运行 dsh web 即可。',
  'done.close': '关闭此窗口',
};

const DICT_EN = {
  'button.label': 'Exit',
  'button.aria': 'Exit DSH service',
  'button.title': 'Shut down the DSH service process',
  'modal.title': 'Shut down DSH service',
  'modal.desc': 'Are you sure you want to shut down the DSH service? Any in-progress conversation will be interrupted. You will need to restart it to use it again.',
  'modal.desc.busy': 'A conversation is currently in progress; exiting will interrupt it. Are you sure you want to shut down the DSH service?',
  'modal.cancel': 'Cancel',
  'modal.confirm': 'Confirm shutdown',
  'modal.confirming': 'Shutting down…',
  'modal.error': 'Error: {error}',
  'done.title': 'Service stopped',
  'done.desc': 'The DSH service has exited gracefully. You can safely close this window; to use it again, run dsh web.',
  'done.desc.unclosed': 'The DSH service has exited gracefully. You can manually close this tab; to use it again, run dsh web.',
  'done.close': 'Close this window',
};

/** 框架注入的 t 缺失时的回退翻译（读 <html lang>，回退 zh）。 */
function makeFallbackT() {
  const lang = (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) || 'zh';
  const dict = lang && lang.toLowerCase().startsWith('en') ? DICT_EN : DICT_ZH;
  return (key, params) => {
    let s = dict[key] || key;
    if (params) for (const k of Object.keys(params)) s = s.split('{' + k + '}').join(String(params[k]));
    return s;
  };
}

/**
 * 侧边栏页脚「退出」操作。
 * @param props - sidebar.footer.action 槽位 owner 共享 { wide } + 框架自动注入
 *                { useSessions（root-scope 全局标准）, t（register locale 选项触发）}。
 */
function ExitButton({ wide, useSessions, t }) {
  const tr = t || makeFallbackT();
  const [phase, setPhase] = react.useState('idle'); // idle | confirm | closing | done | error
  const [error, setError] = react.useState(null);
  const [unclosed, setUnclosed] = react.useState(false);
  const busy = phase === 'closing';
  const layerRef = react.useRef(null);
  const exitBtnRef = react.useRef(null);
  const confirmBtnRef = react.useRef(null);
  const cancelBtnRef = react.useRef(null);
  const dialogRef = react.useRef(null);

  // 当前会话是否有 turn 在跑（root-scope 全局标准 useSessions 自动注入）。
  const running = useSessions
    ? useSessions((s) => { const c = s.byId[s.current]; return c ? c.running : false; })
    : false;

  // 侧边栏外壳默认把 footer 动作区渲染在设置按钮上方——找到 footer 动作区容器
  // 并把它排到设置下方（order:2），压紧间距。宽屏 -4px、56px 轨道 -10px。
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

  // 弹窗打开时：聚焦确认按钮；关闭时：还原焦点到退出按钮。
  react.useEffect(() => {
    if (phase === 'confirm') {
      confirmBtnRef.current?.focus();
      return;
    }
    if (phase === 'idle' && exitBtnRef.current) {
      exitBtnRef.current.focus();
    }
  }, [phase]);

  // 弹窗键盘：Enter=确认、Esc=取消、Tab=焦点陷阱。
  react.useEffect(() => {
    if (phase !== 'confirm') return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setPhase('idle'); return; }
      if (e.key === 'Enter') { e.preventDefault(); doShutdown(); return; }
      if (e.key === 'Tab') {
        const dlg = dialogRef.current;
        if (!dlg) return;
        const focusables = dlg.querySelectorAll('button:not(:disabled)');
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  // doShutdown 引用稳定（组件内函数）——eslint deps 省略；phase 变化时重建。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, busy]);

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
        attemptCloseWindow();
      } else {
        setPhase('error');
        setError(String((body && body.error) || 'shutdown failed'));
      }
    } catch (e) {
      // 进程已退出导致 fetch 失败——这其实意味着关机成功。
      setPhase('done');
      attemptCloseWindow();
    }
  }

  /** 尽力关闭当前窗口；若失败（普通标签页），检测后切换 done 文案。 */
  function attemptCloseWindow() {
    setUnclosed(false);
    window.setTimeout(() => {
      try { window.close(); } catch (e) { /* ignore */ }
      // 给 window.close() 一点时间生效，再检测。
      window.setTimeout(() => {
        if (!window.closed) setUnclosed(true);
      }, 400);
    }, 800);
  }

  // —— 确认弹窗 ——
  if (phase === 'confirm') {
    return react.createElement('div', {
      className: 'dsx-overlay',
      onClick: () => { if (!busy) setPhase('idle'); },
      'aria-modal': 'true', role: 'dialog',
    },
      react.createElement('div', {
        ref: dialogRef,
        className: 'dsx-dialog',
        onClick: (e) => e.stopPropagation(),
      },
        react.createElement('p', { className: 'dsx-dialog-title' }, tr('modal.title')),
        running
          ? react.createElement('p', { className: 'dsx-dialog-busy' }, tr('modal.desc.busy'))
          : react.createElement('p', { className: 'dsx-dialog-desc' }, tr('modal.desc')),
        error !== null && react.createElement('p', { className: 'dsx-dialog-error' }, tr('modal.error', { error })),
        react.createElement('div', { className: 'dsx-actions' },
          react.createElement('button', {
            ref: cancelBtnRef, type: 'button', className: 'dsx-btn', disabled: busy,
            onClick: () => setPhase('idle'),
          }, tr('modal.cancel')),
          react.createElement('button', {
            ref: confirmBtnRef, type: 'button', className: 'dsx-btn dsx-btn-primary', disabled: busy,
            onClick: doShutdown,
          }, busy ? tr('modal.confirming') : tr('modal.confirm'))
        )
      )
    );
  }

  // —— 退出成功后的整页反馈 ——
  if (phase === 'done') {
    return react.createElement('div', { className: 'dsx-done' },
      react.createElement('div', { className: 'dsx-done-icon' }, react.createElement(CheckIcon, null)),
      react.createElement('p', { className: 'dsx-done-title' }, tr('done.title')),
      react.createElement('p', { className: 'dsx-done-desc' }, tr(unclosed ? 'done.desc.unclosed' : 'done.desc')),
      react.createElement('div', { className: 'dsx-done-actions' },
        react.createElement('button', {
          type: 'button', className: 'dsx-btn',
          onClick: () => { try { window.close(); } catch (e) { /* ignore */ } },
        }, tr('done.close'))
      )
    );
  }

  // —— 侧边栏按钮（idle / closing / error 共用） ——
  return react.createElement('div', {
    ref: layerRef,
    className: wide ? 'dsx-layer' : 'dsx-layer dsx-rail'
  },
    react.createElement('button', {
      ref: exitBtnRef,
      type: 'button',
      className: 'dsx-badge',
      'aria-label': tr('button.aria'),
      title: tr('button.title'),
      disabled: busy,
      onClick: () => {
        if (busy) return;
        if (phase === 'error') setError(null);
        setPhase('confirm');
      },
    },
      react.createElement(PowerIcon, null),
      wide && react.createElement('span', { className: 'dsx-label' }, tr('button.label'))
    )
  );
}

function apply(ctx) {
  const slots = ctx.get('slots');
  if (slots === undefined) return;

  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-dsh-plugin', NS);
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  // —— i18n：向 locale 服务注册 zh/en 字典（locale 服务可用时）——
  const locale = ctx.get('locale');
  if (locale !== undefined && typeof locale.register === 'function') {
    ctx.effect(() => locale.register(NS_LOCALE, { zh: DICT_ZH, en: DICT_EN }), NS + ':locale');
  }

  // —— 页面存活上报 ——
  const token = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
  const beat = () => {
    try {
      fetch(EXIT_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'hello', token }),
      }).catch(() => {});
    } catch (e) {}
  };
  const sendBye = () => {
    try {
      const payload = JSON.stringify({ action: 'bye', token });
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(EXIT_URL, new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(EXIT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload }).catch(() => {});
      }
    } catch (e) {}
  };
  const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
  beat();
  const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
  window.addEventListener('pagehide', sendBye);
  document.addEventListener('visibilitychange', onVisible);

  // 注册到 sidebar.footer.action；locale 选项触发框架向组件注入 t。
  slots.inject('sidebar.footer.action', () => slots.register({
    name: 'sidebar.footer.action',
    id: NS,
    locale: NS_LOCALE,
  }, ExitButton));

  ctx.effect(() => () => {
    clearInterval(timer);
    window.removeEventListener('pagehide', sendBye);
    document.removeEventListener('visibilitychange', onVisible);
    if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  }, NS + ':lifecycle');
}

return module.exports; } });
