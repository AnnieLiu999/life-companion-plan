#!/bin/bash
# 精灵伴侣成长计划 - 本地服务器启动器（macOS 双击即用）
# 双击本文件：自动起服务 + 打开浏览器；关闭此窗口即停止服务。
#
# 说明：本脚本所在目录为 scripts/，项目根目录为 scripts/ 的上一级，
# 因此在任何位置克隆仓库后都能正确定位，无需修改路径。

# 项目根目录 = 本脚本所在目录（scripts/）的上一级
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIR="$(dirname "$SCRIPT_DIR")"
PORT=8090

# 若已在运行，直接打开浏览器（不重复起）
if lsof -ti :$PORT >/dev/null 2>&1; then
    echo "✓ 服务器已在运行，正在打开浏览器..."
    open "http://localhost:$PORT"
    sleep 2
    exit 0
fi

# 进入项目目录
if ! cd "$DIR" 2>/dev/null; then
    echo "✗ 错误：找不到项目目录 $DIR"
    read -n 1 -s -r -p "按任意键关闭窗口..."
    exit 1
fi

# 启动服务器（后台运行，关闭窗口时自动结束）
/usr/bin/python3 -m http.server $PORT --bind 127.0.0.1 --directory "$DIR" &
SERVER_PID=$!

# 窗口关闭 / 脚本退出时，顺手关掉服务器
cleanup() {
    kill $SERVER_PID 2>/dev/null
}
trap cleanup EXIT INT TERM

# 等服务器绑定端口
sleep 1.5

# 打开浏览器
open "http://localhost:$PORT"

echo "✓ 服务器已启动 (PID $SERVER_PID)"
echo "✓ 已在浏览器打开 http://localhost:$PORT"
echo ""
echo "提示：关闭此 Terminal 窗口即可停止服务。"
echo "---------------------------------------------------------"

# 保持窗口打开，等待服务器进程
wait $SERVER_PID
