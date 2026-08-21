#!/bin/bash
# dsh-sidebar-exit — macOS 启动器
#
# 双击此文件（或在终端执行）：
#   1. 如果 dsh web 服务未运行，先在后台启动它（日志写到 ~/.dsh/web.log）；
#   2. 等待服务就绪；
#   3. 打开已安装的 Chrome 应用窗口（默认查找 "DeepSeek Harness"，
#      可用环境变量 DSH_WEB_APP_NAME 覆盖），找不到则回退打开普通浏览器页面。
#
# 使用场景：用「退出」按钮关掉服务后，双击本启动器即可一键恢复使用。
#
# 可选环境变量：
#   DSH_WEB_PORT     服务端口（默认 3080）
#   DSH_WEB_APP_NAME Chrome 应用名（默认 "DeepSeek Harness"）
#   DSH_WEB_OPEN     设为 0 时不打开窗口（只启动服务）

set -u

PORT="${DSH_WEB_PORT:-3080}"
APP_NAME="${DSH_WEB_APP_NAME:-DeepSeek Harness}"
URL="http://127.0.0.1:${PORT}"
LOG="$HOME/.dsh/web.log"

is_up() {
  curl -s -o /dev/null -m 1 "$URL/" 2>/dev/null
}

start_service() {
  echo "[dsh-launcher] starting dsh web on port ${PORT} ..."
  mkdir -p "$HOME/.dsh"
  nohup dsh web --port "$PORT" --no-open >>"$LOG" 2>&1 &
  # 轮询等待就绪（最多 30 秒）
  for _ in $(seq 1 30); do
    if is_up; then
      echo "[dsh-launcher] service is up."
      return 0
    fi
    sleep 1
  done
  echo "[dsh-launcher] ERROR: service did not become ready in 30s. See $LOG" >&2
  return 1
}

if is_up; then
  echo "[dsh-launcher] dsh web already running on port ${PORT}."
else
  start_service || exit 1
fi

if [ "${DSH_WEB_OPEN:-1}" != "0" ]; then
  if open -a "$APP_NAME" 2>/dev/null; then
    echo "[dsh-launcher] opened app \"$APP_NAME\"."
  else
    echo "[dsh-launcher] app \"$APP_NAME\" not found, opening $URL in the default browser ..."
    open "$URL"
  fi
fi

echo "[dsh-launcher] done."
