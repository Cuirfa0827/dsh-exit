window.__ModuleLoader__.load({ id: "dsh-sidebar-exit", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apply = apply;

/**
 * dsh-sidebar-exit 浏览器半部：侧边栏底部「退出」按钮。
 *
 * 注册到侧边栏外壳的 `sidebar.footer.action` 槽位（紧挨 Settings 行的
 * 快捷操作区，与官方 Cordis 面板按钮同一位置）。展开态显示「图标 + 退出」，
 * 56px 收起轨道下显示圆形图标按钮。点击后二次确认，POST /_dsh/exit 关机，
 * 成功后尝试关闭窗口。样式引用 DSH 主题 token（--dsw-alias-*）。
 */
const react = require("react");

const NS = "sidebar-exit";
const EXIT_URL = "/_dsh/exit";
const HEARTBEAT_INTERVAL_MS = 5000;

const CSS = '' +
  '.dsx-layer{flex:none;align-items:center;width:100%;height:42px;margin:8px 0 0;display:flex;position:relative}' +
  '.dsx-layer.dsx-rail{width:36px;height:36px;margin:0}' +
  '.dsx-badge{width:100%;height:42px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:transparent;border:none;border-radius:12px;align-items:center;gap:8px;margin:0 -2px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden}' +
  '.dsx-badge:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}' +
  '.dsx-badge:disabled{opacity:.5;cursor:default}' +
  '.dsx-layer.dsx-rail .dsx-badge{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;padding:0}' +
  '.dsx-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}' +
  '.dsx-done{color:var(--dsw-alias-state-success-primary)}' +
  '.dsx-error{color:var(--dsw-alias-state-error-primary)}';

/** 电源图标（inline SVG，跟随 currentColor）。 */
function PowerIcon() {
  return react.createElement('svg', {
    width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true
  },
    react.createElement('path', { d: 'M8 1.8v6.4', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
    react.createElement('path', { d: 'M4.3 4.4a5 5 0 1 0 7.4 0', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' })
  );
}

/**
 * 侧边栏页脚「退出」操作。
 * @param props - sidebar.footer.action 槽位 owner 共享：列状态。
 */
function ExitButton({ wide }) {
  const [phase, setPhase] = react.useState('idle'); // idle | closing | done | error
  const busy = phase === 'closing';
  const layerRef = react.useRef(null);

  // 侧边栏外壳默认把 footer 动作区渲染在设置按钮上方。
  // 从本组件向上找到 footer 动作区容器（其父级是 flex column 且至少两个
  // 子元素的最近祖先，即 footArea），把它排到设置按钮下方（order: 2）。
  react.useEffect(() => {
    let el = layerRef.current?.parentElement;
    while (el) {
      const parent = el.parentElement;
      if (!parent) break;
      const style = getComputedStyle(parent);
      if (style.display === 'flex' && style.flexDirection === 'column' && parent.children.length >= 2) {
        el.style.order = '2';
        break;
      }
      el = parent;
    }
  }, []);

  async function onShutdown() {
    if (busy) return;
    if (phase === 'error') setPhase('idle');
    if (!window.confirm('确定要关闭 DSH 服务吗？正在进行的对话将被中断。')) return;
    setPhase('closing');
    try {
      const res = await fetch(EXIT_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'shutdown' }),
      });
      const body = await res.json();
      if (body && body.ok) {
        setPhase('done');
        // 尝试关闭窗口（安装成应用的独立窗口通常可以关闭；普通标签页静默失败）。
        window.setTimeout(() => { try { window.close(); } catch (e) { /* ignore */ } }, 800);
      } else {
        setPhase('error');
      }
    } catch (e) {
      // 进程已退出导致 fetch 失败——这其实意味着关机成功。
      setPhase('done');
    }
  }

  const done = phase === 'done';
  const failed = phase === 'error';
  const label = done ? '已关闭' : failed ? '退出失败' : '退出';

  return react.createElement('div', {
    ref: layerRef,
    className: wide ? 'dsx-layer' : 'dsx-layer dsx-rail'
  },
    react.createElement('button', {
      type: 'button',
      className: 'dsx-badge' + (done ? ' dsx-done' : failed ? ' dsx-error' : ''),
      'aria-label': '退出 DSH 服务',
      title: done ? 'DSH 服务已退出' : '关闭 DSH 服务进程',
      disabled: busy,
      onClick: onShutdown,
    },
      react.createElement(PowerIcon, null),
      wide && react.createElement('span', { className: 'dsx-label' }, label)
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

  // 页面心跳：让宿主知道当前页面还开着（窗口关闭自动退出功能需要）。
  // 宿主在 exitOnWindowClose 关闭时直接忽略，代价可忽略。
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
  beat();
  const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);

  slots.inject('sidebar.footer.action', () => slots.register({
    name: 'sidebar.footer.action',
    id: NS,
  }, ExitButton));

  ctx.effect(() => () => {
    clearInterval(timer);
    if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  }, NS + ':lifecycle');
}

return module.exports; } });
