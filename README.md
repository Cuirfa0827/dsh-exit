# dsh-exit

侧边栏「退出」按钮 · 一键优雅关闭 DSH 服务

[English](./README_EN.md) | 中文

## 为什么需要

关闭浏览器标签页**不会**结束 dsh 的后台服务进程。本插件在侧边栏底部放一个「退出」按钮，点一下即可关闭服务——无需命令行、无需打开设置面板。

## 功能

- **侧边栏退出按钮**：设置按钮正下方，展开态显示图标 + 文字，收起态为圆形图标
- **居中确认弹窗**：现代风格，支持键盘（Enter 确认 / Esc 取消）
- **整页关闭反馈**：确认后显示「服务已关闭」；检测到浏览器无法自动关标签页时提示手动关闭
- **进行中任务感知**：有对话在跑时弹窗显示额外警告
- **关闭最后一个窗口自动退出**（可选）：所有标签页关闭后约 6 秒服务自动退出，刷新页面不会误触发
- **中英双语**：跟随 DSH locale 自动切换
- **回环安全护栏**：关机端点只接受 127.0.0.1 / localhost 的请求

## 安装

```bash
dsh plugin --profile web add dsh-exit
# 或从 GitHub 安装：
# dsh plugin --profile web add git+https://github.com/Cuirfa0827/dsh-exit.git
```

安装后**重启 dsh web**，侧边栏底部即出现「退出」按钮。

### 启用「关最后一个窗口自动退出」

默认关闭。在 profile 的 `cordis.patch.yml` 中覆盖配置后重启：

```yaml
# $DSH_HOME/profiles/web/cordis.patch.yml
- id: sidebar-exit
  config:
    exitOnWindowClose: true
```

开启后：关闭最后一个标签页 → 页面发送关闭信标 → 宿主等待 5 秒宽限（刷新时新页面会在此期间重新注册并取消退出）→ 无页面则自动退出。多标签页时关一个不影响，关最后一个才退出。

## 相关

本插件 fork 自 [dsh-shutdown](https://www.npmjs.com/package/dsh-shutdown)（MIT，作者 replicant）：保留其优雅退出端点设计，把入口从 Settings 面板移到侧边栏页脚，并新增窗口关闭自动退出、回环安全护栏、居中确认弹窗与中英双语。

## 许可

[MIT](./LICENSE)
