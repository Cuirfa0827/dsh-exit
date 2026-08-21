import Cocoa
import WebKit

// dsh-sidebar-exit — macOS 原生应用（WKWebView 外壳）
//
// 行为：
//   1. 启动时检查 dsh web 服务（默认 127.0.0.1:3080）；未运行则后台拉起
//      `dsh web --no-open` 并轮询等待就绪（最多 30 秒）。
//   2. 用原生 WebView 窗口加载 dsh Web UI —— 不依赖 Chrome / 浏览器安装应用。
//   3. 关闭窗口即退出应用；页面心跳随之停止，配合插件（exitOnWindowClose）
//      关闭最后一个窗口后 dsh 服务约 10~15 秒自动退出。
//
// 完全独立于 dsh 本体：不改动 dsh 任何文件，仅作为外部外壳。
// 可配置环境变量：DSH_WEB_PORT（端口，默认 3080）。

let DEFAULT_PORT = 3080

func serviceURL(_ port: Int) -> URL {
    URL(string: "http://127.0.0.1:\(port)/")!
}

func isServiceUp(_ port: Int) -> Bool {
    let sem = DispatchSemaphore(value: 0)
    var up = false
    var req = URLRequest(url: serviceURL(port))
    req.timeoutInterval = 1
    URLSession.shared.dataTask(with: req) { _, resp, _ in
        if let http = resp as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) {
            up = true
        }
        sem.signal()
    }.resume()
    _ = sem.wait(timeout: .now() + 2)
    return up
}

func startService(_ port: Int) -> Bool {
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: "/bin/zsh")
    // 后台启动，日志写到 ~/.dsh/web.log；--no-open 避免再弹浏览器。
    proc.arguments = ["-lc",
        "mkdir -p $HOME/.dsh && nohup dsh web --port \(port) --no-open >> $HOME/.dsh/web.log 2>&1 &"]
    do {
        try proc.run()
    } catch {
        NSLog("dsh-launcher: failed to start dsh web: \(error)")
        return false
    }
    for _ in 0 ..< 30 {
        if isServiceUp(port) { return true }
        Thread.sleep(forTimeInterval: 1)
    }
    NSLog("dsh-launcher: dsh web did not become ready on port \(port)")
    return false
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    let port = Int(ProcessInfo.processInfo.environment["DSH_WEB_PORT"] ?? "") ?? DEFAULT_PORT

    func applicationDidFinishLaunching(_ note: Notification) {
        if !isServiceUp(port) {
            NSLog("dsh-launcher: starting dsh web ...")
            _ = startService(port) // 仍不可用则 WebView 会显示错误页
        }
        let config = WKWebViewConfiguration()
        webView = WKWebView(frame: .zero, configuration: config)
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.title = "DSH"
        window.center()
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        webView.load(URLRequest(url: serviceURL(port)))
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true // 关窗即退出应用（页面心跳停止 → 插件触发服务自动退出）
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
