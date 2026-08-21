#!/bin/bash
# dsh-exit — 构建 macOS 原生 App（WKWebView 外壳）
#
# 依赖：macOS + Xcode 命令行工具（swiftc）。
# 产物：macapp/DSH.app —— 复制到 /Applications 即可使用：
#   cp -R DSH.app /Applications/
#
# 用法：./build.sh
set -euo pipefail
cd "$(dirname "$0")"

APP="DSH.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "[build] compiling main.swift ..."
swiftc -O -o "$APP/Contents/MacOS/DSH" Sources/main.swift

cp Info.plist "$APP/Contents/Info.plist"

if [ -f Resources/icon.icns ]; then
  cp Resources/icon.icns "$APP/Contents/Resources/"
  plutil -replace CFBundleIconFile -string icon "$APP/Contents/Info.plist"
  echo "[build] icon installed"
fi

echo "[build] done: $APP"
echo "        安装到 Applications: cp -R \"$APP\" /Applications/"
