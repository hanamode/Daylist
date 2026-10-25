#!/bin/zsh
# 日课 · DAYLIST / 本地启动
# 双击运行；关闭终端窗口即可停止服务。

cd "$(dirname "$0")" || exit 1

PORT=4173
URL="http://127.0.0.1:$PORT/"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "本地服务已在运行：$URL"
  open "$URL"
  exit 0
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT INT TERM

sleep 0.7
open "$URL"

echo "日课已启动：$URL"
echo "关闭这个窗口即可停止。"
wait "$SERVER_PID"
