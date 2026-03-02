#!/bin/bash
# HSNPM 通知服务启动脚本 - 支持 systemd 和传统启动方式

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="hsnpm-notification"
BINARY="$SCRIPT_DIR/hsnpm-notification-service"
ENV_FILE="$SCRIPT_DIR/.env"
SYSTEMD_SERVICE="hsnpm-notification.service"
SYSTEMD_FILE="/etc/systemd/system/$SYSTEMD_SERVICE"

# 检查二进制文件
if [ ! -f "$BINARY" ]; then
    echo "❌ HSNPM 二进制文件不存在: $BINARY"
    exit 1
fi

# 设置环境变量
if [ -f "$ENV_FILE" ]; then
    echo "📄 加载环境变量: $ENV_FILE"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

echo "🔍 检查 HSNPM 服务状态..."

# 检查是否已在运行
if pgrep -f "$BINARY" > /dev/null; then
    echo "⚠️  HSNPM 服务已在运行，先停止..."
    # 尝试使用 systemd 停止
    if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet "$SYSTEMD_SERVICE" 2>/dev/null; then
        echo "使用 systemctl 停止服务..."
        systemctl stop "$SYSTEMD_SERVICE" || true
    else
        # 传统方式停止
        pkill -f "$BINARY" || true
    fi
    sleep 2
fi

# 优先使用 systemd 启动
if command -v systemctl >/dev/null 2>&1 && [ -f "$SYSTEMD_FILE" ]; then
    echo "🚀 使用 systemd 启动 HSNPM 服务..."

    # 确保服务已启用（开机自启）
    if ! systemctl is-enabled "$SYSTEMD_SERVICE" >/dev/null 2>&1; then
        echo "启用 systemd 服务（开机自启）..."
        systemctl enable "$SYSTEMD_SERVICE" || echo "⚠️  无法启用服务，继续启动..."
    fi

    # 启动服务
    systemctl start "$SYSTEMD_SERVICE"

    # 等待并检查状态
    sleep 3
    if systemctl is-active --quiet "$SYSTEMD_SERVICE"; then
        echo "✅ HSNPM systemd 服务已启动"
        systemctl status "$SYSTEMD_SERVICE" --no-pager | head -10
    else
        echo "❌ systemd 启动失败，尝试传统方式..."
        # 回退到传统方式
        echo "🔄 使用传统方式启动..."
        cd "$SCRIPT_DIR"
        nohup "$BINARY" > "$SCRIPT_DIR/hsnpm.log" 2>&1 &
        PID=$!
        sleep 2
        if ps -p $PID > /dev/null; then
            echo "✅ HSNPM 服务已启动 (PID: $PID)"
            echo "📝 日志文件: $SCRIPT_DIR/hsnpm.log"
        else
            echo "❌ HSNPM 服务启动失败"
            cat "$SCRIPT_DIR/hsnpm.log" 2>/dev/null || true
            exit 1
        fi
    fi
else
    # 传统启动方式
    echo "🚀 使用传统方式启动 HSNPM 服务..."
    cd "$SCRIPT_DIR"
    nohup "$BINARY" > "$SCRIPT_DIR/hsnpm.log" 2>&1 &
    PID=$!

    sleep 2
    if ps -p $PID > /dev/null; then
        echo "✅ HSNPM 服务已启动 (PID: $PID)"
        echo "📝 日志文件: $SCRIPT_DIR/hsnpm.log"
    else
        echo "❌ HSNPM 服务启动失败"
        cat "$SCRIPT_DIR/hsnpm.log" 2>/dev/null || true
        exit 1
    fi
fi

echo ""
echo "📋 服务信息:"
echo "   - 二进制文件: $BINARY"
echo "   - 配置文件: $ENV_FILE"
echo "   - 工作目录: $SCRIPT_DIR"
echo ""
echo "🔧 管理命令:"
if command -v systemctl >/dev/null 2>&1 && [ -f "$SYSTEMD_FILE" ]; then
    echo "   - 查看状态: systemctl status $SYSTEMD_SERVICE"
    echo "   - 查看日志: journalctl -u $SYSTEMD_SERVICE -f"
    echo "   - 重启服务: systemctl restart $SYSTEMD_SERVICE"
    echo "   - 停止服务: systemctl stop $SYSTEMD_SERVICE"
else
    echo "   - 查看日志: tail -f $SCRIPT_DIR/hsnpm.log"
    echo "   - 停止服务: pkill -f hsnpm-notification-service"
fi