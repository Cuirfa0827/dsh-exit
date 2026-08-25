/**
 * dsh-exit — DeepSeek Harness 退出插件（Host 半部）。
 *
 * 提供 `/_dsh/exit` 端点（仅 POST，JSON body，`action` 字段）：
 *   - `{ action: 'shutdown' }`                —— 侧边栏「退出」按钮的显式关机：
 *                                              先返回 200 确认响应（让浏览器拿到
 *                                              “正在关闭”的反馈），500ms 后优雅退出
 *                                              宿主进程。
 *   - `{ action: 'hello', token }`            —— 页面心跳注册（崩溃兜底用）。
 *   - `{ action: 'bye', token }`              —— 页面关闭信标（pagehide + sendBeacon，
 *                                              窗口关闭/刷新/导航时由浏览器可靠发送）。
 *
 * 窗口关闭自动退出（config.exitOnWindowClose）：关闭检测以「bye 信标 + 3 秒宽限」
 * 为主——bye 后若宽限期内没有新页面重新注册（刷新场景），且注册表已空，则退出；
 * hello 会取消待执行的退出与宽限检查。心跳仅作为崩溃/冻结页面的兜底清理，TTL 放宽
 * 到 90 秒，避免浏览器对后台标签页定时器节流（最低 1 次/分钟）导致的误判。
 * 早期实现用「5 秒心跳 + 12 秒 TTL」判断存活，会把被节流的后台页面误判为已关闭
 * 而自杀——该缺陷已由此方案取代。
 *
 * 安全：端点仅接受来自回环地址（127.0.0.1 / localhost / [::1]）的请求 ——
 * Origin 与 Host 任一指向非回环权威即拒绝（403），防止浏览器里任意网页
 * 通过跨站请求把本地服务关掉。
 *
 * 会话日志为逐事件落盘，空闲时退出安全；正在进行的 turn 请等待其完成后再关闭。
 * @module dsh-exit
 */
export const name = 'dsh-exit';
export const inject = [];

const EXIT_DELAY_MS = 500;
/** 崩溃检测用 TTL：仅用于清理「被冻结/崩溃且未发 bye 的页面」，必须远大于
 * 浏览器对后台标签页定时器的节流间隔（节流可到 1 次/分钟）。 */
const HEARTBEAT_TTL_MS = 90_000;
const SWEEP_INTERVAL_MS = 15_000;
/** bye（页面关闭）后的宽限期：等待同一次刷新/导航产生的新页面重新注册。 */
const BYE_GRACE_MS = 5_000;
// 宽限期 5 秒：覆盖慢网络/慢机器下页面刷新后新页面重新注册 hello 的延迟。
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
	/** 已安排的退出计时器（null = 未安排）。 */
	let exitTimer = null;
	/** bye 宽限检查计时器（null = 未安排）。 */
	let byeCheckTimer = null;

	const scheduleExit = (delay = EXIT_DELAY_MS) => {
		if (exitTimer !== null) return;
		exitTimer = setTimeout(() => {
			process.exit(0);
		}, delay);
	};

	const cancelExit = () => {
		if (exitTimer !== null) {
			clearTimeout(exitTimer);
			exitTimer = null;
		}
	};

	const cancelByeCheck = () => {
		if (byeCheckTimer !== null) {
			clearTimeout(byeCheckTimer);
			byeCheckTimer = null;
		}
	};

	const sweep = () => {
		const now = Date.now();
		for (const [token, lastSeen] of pages) {
			if (now - lastSeen > HEARTBEAT_TTL_MS) pages.delete(token);
		}
		// 崩溃/冻结清理后若已无页面且曾经有过 → 退出（仅兜底：正常关闭走 bye 宽限）。
		if (exitOnWindowClose && hasSeenPage && pages.size === 0) scheduleExit();
	};

	const interval = setInterval(sweep, SWEEP_INTERVAL_MS);
	ctx.effect(() => () => {
		clearInterval(interval);
		cancelByeCheck();
		cancelExit();
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
						// 新页面到来（含刷新/导航后的重新注册）：取消待执行的退出与宽限检查。
						cancelByeCheck();
						cancelExit();
						respond(res, 200, { ok: true, exitOnWindowClose });
					} else if (action === 'bye' && token) {
						pages.delete(token);
						// 宽限期内等待新页面重新注册（刷新场景）；期间若又收到 hello 则取消。
						cancelByeCheck();
						byeCheckTimer = setTimeout(() => {
							byeCheckTimer = null;
							if (exitOnWindowClose && hasSeenPage && pages.size === 0) scheduleExit();
						}, BYE_GRACE_MS);
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
