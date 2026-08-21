# dsh-sidebar-exit

Sidebar "Exit" button · one-click graceful shutdown of the DSH service · optional exit-on-window-close

English | [中文](./README.md)

## ✨ Why

Closing a browser window does **not** stop the dsh background service — it keeps occupying the port and memory. This plugin puts an "Exit" button at the bottom of the sidebar (right below the Settings row, in the same footer-action seat as the official Cordis panel button) so you can shut the service down in one click — no Settings panel, no terminal.

## ✨ Features

- **🖱️ Sidebar "Exit" button**: at the sidebar foot, directly below the Settings button (official footer-action seat `sidebar.footer.action` with an order adjustment); icon + label when expanded, round icon button in the 56px rail
- **🛡️ Double confirmation**: a confirm dialog before shutdown prevents accidental clicks
- **✅ Success feedback**: requests shutdown immediately; closes the window when possible (installed-app windows), otherwise shows "已关闭"
- **🪟 Optional exit-on-window-close**: with `exitOnWindowClose: true`, the service exits ~10–15s after the last window/tab is closed; refreshing a page does NOT trigger it (the new page re-registers its heartbeat)
- **🔒 Loopback security fence**: the shutdown endpoint only accepts requests from 127.0.0.1 / localhost, so arbitrary web pages cannot cross-site shut down your local service

## 📦 Install

```bash
dsh plugin --profile web add dsh-sidebar-exit
# or from GitHub:
# dsh plugin --profile web add git+https://github.com/<your-username>/dsh-sidebar-exit.git
# restart dsh web to activate
```

After install, **restart dsh web** — an "Exit" button appears at the bottom of the sidebar.

### Enable "exit after the last window closes"

Off by default (so closing one tab never kills the service accidentally). Override the row config in the profile's `cordis.patch.yml`, then restart:

```yaml
# $DSH_HOME/profiles/web/cordis.patch.yml
- id: sidebar-exit
  config:
    exitOnWindowClose: true
```

When enabled, every open page heartbeats the host; once the last window/tab closes (no heartbeat for ~12s), the service exits gracefully. With multiple windows open, closing one of them does not exit — only the last one does.

> ⚠️ Side effect: while a page stays open, the service keeps running — auto-exit only fires when the last window closes.

## 🧠 How it works

- Shutdown endpoint: `/_dsh/exit` (POST only, JSON body)
  - `{ "action": "shutdown" }` — explicit shutdown: responds "shutting down" first, then `process.exit(0)` after 500ms
  - `{ "action": "hello", "token" }` — page heartbeat registration
  - `{ "action": "bye", "token" }` — page deregistration (reserved)
- Window-close detection = heartbeat + TTL sweep, not a `pagehide` beacon: refreshing a page re-registers the heartbeat immediately, so it never falsely exits
- Session logs are written per event; exiting while idle is safe. Wait for an in-flight turn to finish before closing.

## 🔒 Security notes

`/_dsh/exit` has no authentication layer (same as dsh-shutdown and other community plugins), but it enforces two loopback checks:

1. The `Origin` header must be a loopback origin — cross-site pages (`https://evil.com`) get 403;
2. The `Host` header must be a loopback authority — defends against DNS rebinding.

Since `dsh web` only listens on loopback today, these checks cover the reachable attack surface. If `--host 0.0.0.0` ever becomes supported, do not use this plugin on a non-loopback listener.

## 🧩 Related

A fork of [dsh-shutdown](https://www.npmjs.com/package/dsh-shutdown) (MIT, by replicant): keeps its graceful-exit endpoint design, moves the entry point from the Settings panel to the sidebar footer, and adds exit-on-window-close plus loopback security checks.

## 📄 License

[MIT](./LICENSE)
