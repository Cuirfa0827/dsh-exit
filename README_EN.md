# dsh-exit

Sidebar "Exit" button · one-click graceful DSH service shutdown

English | [中文](./README.md)

## Why

Closing a browser tab does **not** stop the dsh background service. This plugin puts an "Exit" button at the bottom of the sidebar so you can shut the service down in one click — no terminal, no Settings panel.

## Features

- **Sidebar exit button**: directly below Settings; icon + label when expanded, round icon in the 56px collapsed rail
- **Centered confirm dialog**: modern style, keyboard support (Enter to confirm, Esc to cancel)
- **Full-page closed feedback**: shows "Service stopped" after shutdown; detects when the browser can't auto-close the tab and prompts manual close
- **Active-turn awareness**: shows an extra warning in the dialog when a conversation is in progress
- **Exit on last window close** (optional): service auto-exits ~6s after the last tab is closed; refreshing a page does NOT trigger it
- **Bilingual (zh/en)**: follows the DSH locale automatically
- **Loopback security**: the shutdown endpoint only accepts requests from 127.0.0.1 / localhost

## Install

```bash
dsh plugin --profile web add dsh-exit
# or from GitHub:
# dsh plugin --profile web add git+https://github.com/Cuirfa0827/dsh-exit.git
```

After install, **restart dsh web** — an "Exit" button appears at the bottom of the sidebar.

### Enable "exit after the last window closes"

Off by default. Override the row config in the profile's `cordis.patch.yml`, then restart:

```yaml
# $DSH_HOME/profiles/web/cordis.patch.yml
- id: sidebar-exit
  config:
    exitOnWindowClose: true
```

When enabled: closing the last tab sends a close beacon → the host waits a 5s grace window (a refreshed page re-registers during it, cancelling the exit) → if no pages remain, the service exits. With multiple tabs open, closing one has no effect — only the last one triggers exit.

## Related

A fork of [dsh-shutdown](https://www.npmjs.com/package/dsh-shutdown) (MIT, by replicant): keeps its graceful-exit endpoint design, moves the entry point from the Settings panel to the sidebar footer, and adds exit-on-window-close, loopback security, a centered confirm dialog, and bilingual support.

## License

[MIT](./LICENSE)
