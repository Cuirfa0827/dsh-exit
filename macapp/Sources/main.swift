import Cocoa
import WebKit

// dsh-exit — macOS 原生应用（WKWebView 外壳）
//
// 行为：
//   1. 立即显示窗口（带“正在启动服务…”占位页），不阻塞主线程；
//   2. 后台线程检测 dsh web 服务（默认 127.0.0.1:3080）；未运行则自动拉起
//      `dsh web --no-open`（优先 PATH 里的 dsh，找不到则用 npx 运行
//      @deepseek-ai/dsh），轮询等待就绪后加载 Web UI；
//   3. 页面内点「退出」成功后，插件客户端会通过
//      window.webkit.messageHandlers.dshExit 通知本 App 关闭窗口；
//   4. 关闭窗口即退出应用；页面心跳停止，配合插件（exitOnWindowClose）
//      关闭最后一个窗口后 dsh 服务约 10~15 秒自动退出。
//
// 完全独立于 dsh 本体：不改动 dsh 任何文件，仅作为外部外壳。
// 可配置环境变量：
//   DSH_WEB_PORT  服务端口（默认 3080）
//   DSH_CMD       启动服务的命令前缀（默认自动探测 dsh / npx @deepseek-ai/dsh）

let DEFAULT_PORT = 3080

func serviceURL(_ port: Int) -> URL {
    URL(string: "http://127.0.0.1:\(port)/")!
}

/// 同步探测服务是否可用（阻塞当前线程，仅用于后台队列）。
func isServiceUp(_ port: Int, timeout: TimeInterval = 1) -> Bool {
    let sem = DispatchSemaphore(value: 0)
    var up = false
    var req = URLRequest(url: serviceURL(port))
    req.timeoutInterval = timeout
    URLSession.shared.dataTask(with: req) { _, resp, _ in
        if let http = resp as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) {
            up = true
        }
        sem.signal()
    }.resume()
    _ = sem.wait(timeout: .now() + timeout + 1)
    return up
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!
    let port = Int(ProcessInfo.processInfo.environment["DSH_WEB_PORT"] ?? "") ?? DEFAULT_PORT

    func applicationDidFinishLaunching(_ note: Notification) {
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "dshExit")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.title = "DSH"
        window.center()
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(webView) // 让 WebView 持有键盘焦点（复制粘贴必需）
        NSApp.activate(ignoringOtherApps: true)

        // 先显示占位页，再在后台把服务拉起来——窗口立即出现，绝不白屏卡顿。
        webView.loadHTMLString(Self.loadingHTML(), baseURL: nil)
        bringUpServiceInBackground()
    }

    /// 后台：确保服务在运行并已就绪，然后回到主线程加载 UI。
    func bringUpServiceInBackground() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            var ready = isServiceUp(self.port)
            if !ready {
                self.startService(self.port)
                for _ in 0 ..< 40 { // 最多再等 ~20 秒
                    Thread.sleep(forTimeInterval: 0.5)
                    if isServiceUp(self.port) {
                        ready = true
                        break
                    }
                }
            }
            DispatchQueue.main.async {
                if ready {
                    self.webView.load(URLRequest(url: serviceURL(self.port)))
                } else {
                    self.webView.loadHTMLString(Self.errorHTML(self.port), baseURL: nil)
                }
            }
        }
    }

    /// 后台启动 dsh web（nohup，日志 ~/.dsh/web.log）。
    ///
    /// 注意：macOS 从 Finder / 应用图标启动的进程 PATH 是精简的
    /// （/usr/bin:/bin...），拿不到用户 shell 里的 fnm / nvm / Homebrew
    /// 路径，`dsh`、`npx` 都找不到。因此这里显式探测常见 Node 安装目录并
    /// 注入 PATH，再通过 `npx --yes @deepseek-ai/dsh` 启动（与用户手动的
    /// 启动方式一致）。可用环境变量 DSH_CMD 完全覆盖启动命令。
    func startService(_ port: Int) {
        let env = ProcessInfo.processInfo.environment
        let command: String
        if let custom = env["DSH_CMD"], !custom.isEmpty {
            command = custom
        } else {
            command = "npx --yes @deepseek-ai/dsh"
        }
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/bin/zsh")
        proc.arguments = ["-lc",
            "export PATH=\(Self.resolvedPATH()); mkdir -p $HOME/.dsh; " +
            "nohup \(command) web --no-open --port \(port) >> $HOME/.dsh/web.log 2>&1 &"]
        do {
            try proc.run()
        } catch {
            NSLog("dsh-exit: failed to start dsh web: \(error)")
        }
    }

    /// 探测常见的 Node/npx 安装目录并拼出 PATH（fnm、nvm、Homebrew、系统目录）。
    static func resolvedPATH() -> String {
        let fm = FileManager.default
        let home = NSHomeDirectory()
        var dirs: [String] = []

        func appendNodeBin(_ root: String) {
            guard let versions = try? fm.contentsOfDirectory(atPath: root) else { return }
            let bins = versions
                .compactMap { v -> String? in
                    let bin = root + "/" + v + "/installation/bin"
                    return fm.fileExists(atPath: bin + "/npx") ? bin : nil
                }
                .sorted()
            dirs.append(contentsOf: bins)
        }
        func appendNvmBin(_ root: String) {
            guard let versions = try? fm.contentsOfDirectory(atPath: root) else { return }
            let bins = versions
                .compactMap { v -> String? in
                    let bin = root + "/" + v + "/bin"
                    return fm.fileExists(atPath: bin + "/npx") ? bin : nil
                }
                .sorted()
            dirs.append(contentsOf: bins)
        }
        appendNodeBin(home + "/.local/share/fnm/node-versions")
        appendNvmBin(home + "/.nvm/versions/node")
        dirs += ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"]
        return dirs.joined(separator: ":")
    }

    /// 插件客户端在关机成功后调用 window.webkit.messageHandlers.dshExit。
    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        if message.name == "dshExit" {
            DispatchQueue.main.async {
                NSApp.terminate(nil)
            }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true // 关窗即退出应用（页面心跳停止 → 插件触发服务自动退出）
    }

    static func loadingHTML() -> String {
        """
        <!doctype html><html><head><meta charset="utf-8"><style>
        body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
             background:#0d1117;color:#9ba3b4;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
        .wrap{text-align:center;}
        .dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#4f9cf9;
             animation:pulse 1.2s ease-in-out infinite;}
        @keyframes pulse{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
        p{margin:16px 0 0;font-size:14px;}
        </style></head><body><div class="wrap">
        <div class="dot"></div>
        <p>正在启动 DSH 服务…</p>
        </div></body></html>
        """
    }

    static func errorHTML(_ port: Int) -> String {
        """
        <!doctype html><html><head><meta charset="utf-8"><style>
        body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
             background:#0d1117;color:#9ba3b4;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
        .wrap{text-align:center;max-width:420px;padding:24px;}
        h2{color:#e6edf3;font-size:17px;margin:0 0 8px;}
        p{font-size:13px;line-height:1.7;margin:0;}
        code{background:#161b22;padding:2px 6px;border-radius:6px;font-size:12px;}
        </style></head><body><div class="wrap">
        <h2>无法连接 DSH 服务</h2>
        <p>服务没有在 <code>127.0.0.1:\(port)</code> 上就绪。请确认 dsh 已安装
        （<code>npm i -g @deepseek-ai/dsh</code>），查看日志
        <code>~/.dsh/web.log</code>，然后重新打开本应用。</p>
        </div></body></html>
        """
    }
}

/// 构建标准主菜单（App / 编辑 / 窗口）。
/// WKWebView 应用没有菜单栏时，Cmd+C / Cmd+V / Cmd+A 等快捷键没有菜单项在
/// 响应链里路由，复制粘贴会失效——编辑菜单项的目标为第一响应者（WebView）。
func buildMainMenu() {
    let mainMenu = NSMenu()

    let appItem = NSMenuItem()
    mainMenu.addItem(appItem)
    let appMenu = NSMenu()
    appMenu.addItem(withTitle: "关于 DSH", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "退出 DSH", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    appItem.submenu = appMenu

    let editItem = NSMenuItem()
    mainMenu.addItem(editItem)
    let editMenu = NSMenu(title: "编辑")
    editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
    editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "Z")
    editMenu.addItem(.separator())
    editMenu.addItem(withTitle: "剪切", action: Selector(("cut:")), keyEquivalent: "x")
    editMenu.addItem(withTitle: "拷贝", action: Selector(("copy:")), keyEquivalent: "c")
    editMenu.addItem(withTitle: "粘贴", action: Selector(("paste:")), keyEquivalent: "v")
    editMenu.addItem(withTitle: "全选", action: Selector(("selectAll:")), keyEquivalent: "a")
    editItem.submenu = editMenu

    let windowItem = NSMenuItem()
    mainMenu.addItem(windowItem)
    let windowMenu = NSMenu(title: "窗口")
    windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
    windowMenu.addItem(withTitle: "关闭窗口", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
    windowItem.submenu = windowMenu

    app.mainMenu = mainMenu
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
buildMainMenu()
app.run()
