/**
 * dsh-sidebar-exit — DeepSeek Harness 退出插件（Host 半部）。
 *
 * 提供 `/_dsh/exit` 端点（仅 POST，JSON body，`action` 字段）：
 *   - `{ action: 'shutdown' }`                —— 侧边栏「退出」按钮的显式关机：
 *                                              先返回 200 确认响应（让浏览器拿到
 *                                              “正在关闭”的反馈），500ms 后优雅退出
 *                                              宿主进程。
 *   - `{ action: 'hello', token }`            —— 页面心跳注册（窗口关闭自动退出用）。
 *   - `{ action: 'bye', token }`              —— 页面注销（保留备用；窗口关闭的检测
 *                                              主要依赖心跳 TTL 清扫）。
 *
 * 窗口关闭自动退出（config.exitOnWindowClose）：开启后，宿主维护页面心跳注册表，
 * 定期清扫过期条目；当注册表为空（= 所有窗口/标签页都已关闭或失联）时自动退出。
 * 相比在 pagehide 里发送 bye 信标，纯心跳 + TTL 的方案对「刷新页面」是安全的：
 * 刷新后新页面会立即重新注册心跳，不会误触发退出。
 *
 * 安全：端点仅接受来自回环地址（127.0.0.1 / localhost / [::1]）的请求 ——
 * Origin 与 Host 任一指向非回环权威即拒绝（403），防止浏览器里任意网页
 * 通过跨站请求把本地服务关掉。
 *
 * 会话日志为逐事件落盘，空闲时退出安全；正在进行的 turn 请等待其完成后再关闭。
 * @module dsh-sidebar-exit
 */
export const name = 'dsh-sidebar-exit';
export const inject = [];

const EXIT_DELAY_MS = 500;
const HEARTBEAT_TTL_MS = 12_000;
const SWEEP_INTERVAL_MS = 3_000;
const MAX_BODY_BYTES = 64 * 1024;

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/** 从 Origin / Host 头解析出 hostname；解析失败返回 null。 */
function hostnameOf(value) {
	if (typeof value !== 'string' || value === '') return null;
	try {
		return new URL(value.includes('://') ? value : `http://${value}`).hostname;
	} catch {
		return null;
	}
}

/** 仅当 Origin 与 Host 都是回环权威（或缺失）时放行。 */
function isLoopbackRequest(req) {
	const origin = hostnameOf(req.headers.origin);
	if (origin !== null && !LOOPBACK_HOSTNAMES.has(origin)) return false;
	const host = hostnameOf(req.headers.host);
	if (host !== null && !LOOPBACK_HOSTNAMES.has(host)) return false;
	return true;
}

function respond(res, status, payload) {
	res.statusCode = status;
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.end(JSON.stringify(payload));
}

/** Plugin 入口。config 由 Loader 传入（行配置，见 cordis.patch.yml）。 */
export async function apply(ctx, config) {
	const exitOnWindowClose = (config ?? {}).exitOnWindowClose === true;

	/** 页面心跳注册表：token -> 最近一次心跳时间。 */
	const pages = new Map();
	/** 是否出现过至少一个页面（防止刚启动、尚未连接浏览器时误杀服务）。 */
	let hasSeenPage = false;
	/** 已经安排退出（幂等护栏）。 */
	let exiting = false;

	const scheduleExit = () => {
		if (exiting) return;
		exiting = true;
		setTimeout(() => {
			process.exit(0);
		}, EXIT_DELAY_MS);
	};

	const sweep = () => {
		const now = Date.now();
		for (const [token, lastSeen] of pages) {
			if (now - lastSeen > HEARTBEAT_TTL_MS) pages.delete(token);
		}
		// 只有「曾经有页面、现在一个都没有」才算最后一个窗口关闭；
		// 刚启动还没有任何浏览器连接时（hasSeenPage=false）绝不能退出。
		if (exitOnWindowClose && hasSeenPage && pages.size === 0) scheduleExit();
	};

	const interval = setInterval(sweep, SWEEP_INTERVAL_MS);
	ctx.effect(() => () => {
		clearInterval(interval);
	}, name + ':sweep');

	// 注意：不要 return ctx.inject(...) —— 它返回 fiber，await 后 resolve 为
	// fiber 自身，会被 cordis 当作非法 effect。
	ctx.inject(['webServer'], (webCtx) => {
		const disposeRoute = webCtx.webServer.register({
			kind: 'exact',
			path: '/_dsh/exit',
			handler: (req, res) => {
				if (req.method !== 'POST') {
					respond(res, 405, { ok: false, error: 'method-not-allowed' });
					return;
				}
				if (!isLoopbackRequest(req)) {
					respond(res, 403, { ok: false, error: 'forbidden' });
					return;
				}
				// 读取请求体（普通 webserver 路由不缓冲 body）。
				let body = '';
				let tooLarge = false;
				req.on('data', (chunk) => {
					body += chunk;
					if (body.length > MAX_BODY_BYTES) tooLarge = true;
				});
				req.on('end', () => {
					if (tooLarge) {
						respond(res, 400, { ok: false, error: 'payload-too-large' });
						return;
					}
					let action;
					let token;
					try {
						const parsed = JSON.parse(body || '{}');
						action = parsed?.action;
						token = typeof parsed?.token === 'string' ? parsed.token : null;
					} catch {
						respond(res, 400, { ok: false, error: 'bad-request' });
						return;
					}
					if (action === 'shutdown') {
						respond(res, 200, { ok: true, message: '正在关闭 DSH 服务' });
						scheduleExit();
					} else if (action === 'hello' && token) {
						pages.set(token, Date.now());
						hasSeenPage = true;
						respond(res, 200, { ok: true, exitOnWindowClose });
					} else if (action === 'bye' && token) {
						pages.delete(token);
						respond(res, 200, { ok: true });
					} else {
						respond(res, 400, { ok: false, error: 'bad-request' });
					}
				});
			},
		});
		return () => {
			disposeRoute();
		};
	});
}
