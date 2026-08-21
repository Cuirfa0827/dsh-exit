# dsh-sidebar-exit

侧边栏「退出」按钮 · 一键优雅关闭 DSH 服务进程 · 可选关闭窗口自动退出

[English](./README_EN.md) | 中文

## ✨ 为什么需要

关闭浏览器窗口**不会**结束 dsh 的后台服务进程——服务继续占用端口与内存。本插件在侧边栏底部（Settings 行的正下方，与官方 Cordis 面板按钮同一位置）放一个「退出」按钮，点一下即可关闭服务，无需打开设置面板、无需命令行。

## ✨ 功能一览

- **🖱️ 侧边栏「退出」按钮**：侧边栏底部、设置按钮正下方（官方页脚动作槽位 `sidebar.footer.action` 之上叠加 order 调整）；展开态显示「图标 + 退出」，56px 收起轨道下自动变为圆形图标按钮
- **🛡️ 二次确认**：点击后弹窗确认，防误触
- **✅ 成功反馈**：确认后立即请求关机；若窗口可关闭（安装为应用的窗口）会自动关闭，否则按钮显示「已关闭」
- **🪟 关闭窗口自动退出（可选）**：`exitOnWindowClose: true` 时，所有窗口/标签页都关闭后约 10~15 秒服务自动退出；刷新页面不会误触发（新页面会重新注册心跳）
- **🔒 回环安全护栏**：关机端点只接受来自 127.0.0.1 / localhost 的请求，浏览器里任意网页无法跨站把本地服务关掉

## 📦 安装

```bash
dsh plugin --profile web add dsh-sidebar-exit
# 或从 GitHub 安装：
# dsh plugin --profile web add git+https://github.com/<你的用户名>/dsh-sidebar-exit.git
# 重启 dsh web 生效
```

安装后**重启 dsh web**，侧边栏底部 Settings 下方就会出现「退出」按钮。

### 启用「关闭最后一个窗口自动退出」

默认关闭（避免关掉一个标签页就意外停掉服务）。在 profile 的 `cordis.patch.yml` 里覆盖该行配置后重启：

```yaml
# $DSH_HOME/profiles/web/cordis.patch.yml
- id: sidebar-exit
  config:
    exitOnWindowClose: true
```

开启后：每个打开的页面都会向宿主发送心跳；最后一个窗口/标签页关闭（约 12 秒内无心跳）后服务自动优雅退出。多窗口同时打开时，关掉其中一个不会退出，关掉最后一个才退出。

> ⚠️ 副作用：打开着页面但长时间不用时，服务会一直运行——「自动退出」只在最后一个窗口关闭时触发。

## 🧠 工作原理

- 关机端点：`/_dsh/exit`（仅 POST，JSON body）
  - `{ "action": "shutdown" }` —— 显式关机：先返回「正在关闭」响应，500ms 后 `process.exit(0)`
  - `{ "action": "hello", "token" }` —— 页面心跳注册
  - `{ "action": "bye", "token" }` —— 页面注销（备用）
- 窗口关闭检测 = 心跳 + TTL 清扫，而非 `pagehide` 信标：刷新页面时新页面立即重新注册心跳，不会误触发退出
- 会话日志为逐事件落盘，空闲时退出安全；正在进行的对话请等待其完成后再关闭

## 🔒 安全说明

`/_dsh/exit` 没有认证层（与 dsh-shutdown 等社区插件一致），但做了两层回环限制：

1. `Origin` 头必须指向回环地址——跨站网页（`https://evil.com`）发来的请求直接 403；
2. `Host` 头必须指向回环地址——防 DNS rebinding。

由于 `dsh web` 目前只支持监听回环地址，这两道检查覆盖了实际可达的攻击面。若未来支持 `--host 0.0.0.0`，请勿在非回环监听下使用本插件。

## 🖥️ macOS 原生 App（推荐，替代浏览器「安装为应用」）

浏览器「安装为应用」的窗口只是指向 URL 的壳，**无法启动本地进程**——服务关掉后点图标只会连不上。本插件附带一个 macOS 原生 App（`macapp/`，Swift + WKWebView，零外部依赖，不侵入 dsh 本体）：

```bash
cd macapp && ./build.sh          # 生成 DSH.app（需 macOS + swiftc）
cp -R DSH.app /Applications/     # 安装
```

App 行为：

- 启动时检测 `127.0.0.1:3080` 的 dsh 服务；未运行则自动后台拉起 `dsh web` 并等待就绪，然后用自己的窗口加载 Web UI——**点图标 = 服务自动启动 + 界面直接可用**；
- 与插件联动：App 窗口里同样有「退出」按钮；关闭 App 窗口（即最后一个窗口）后，服务约 10~15 秒自动退出；
- 环境变量 `DSH_WEB_PORT` 可改端口。

**备选：命令行启动器** `scripts/start-dsh.command`（双击运行，效果同上，但窗口仍是浏览器）。

**常驻替代方案**：`scripts/dsh-web.plist` 是 launchd LaunchAgent 模板（`KeepAlive` 常驻、退出即自动重启）。⚠️ 启用后「退出」按钮语义会变成「重启」，与关机的初衷冲突，仅在确实需要服务永续在线时使用。

## 🧩 相关

本插件是 [dsh-shutdown](https://www.npmjs.com/package/dsh-shutdown)（MIT，作者 replicant）的 fork：保留其优雅退出端点设计，把入口从 Settings 面板移到侧边栏页脚，并新增窗口关闭自动退出与回环安全护栏。

## 📄 许可

[MIT](./LICENSE)
