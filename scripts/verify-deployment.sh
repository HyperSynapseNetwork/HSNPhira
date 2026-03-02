#!/bin/bash
# 验证部署脚本

set -e

# 参数检查
if [ $# -lt 4 ]; then
    echo "用法: $0 <DEPLOY_USER> <SERVER_HOST> <SSH_PASSWORD> <DEPLOY_DIR>"
    echo "示例: $0 user example.com password123 /www/wwwroot/phira.htadiy.cc"
    exit 1
fi

DEPLOY_USER="$1"
SERVER_HOST="$2"
SSH_PASSWORD="$3"
DEPLOY_DIR="$4"

echo "验证部署..."
sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=accept-new "$DEPLOY_USER@$SERVER_HOST" "
    DEPLOY_DIR=\"$DEPLOY_DIR\"
    echo \"检查部署目录:\"
    ls -la \"\$DEPLOY_DIR\" | head -10
    echo \"\"
    echo \"检查关键文件:\"
    for file in index.html sitemap.xml robots.txt; do
        if [ -f \"\$DEPLOY_DIR/\$file\" ]; then
            echo \"✅ \$file 存在\"
        else
            echo \"❌ \$file 不存在\"
        fi
    done
    echo \"\"
    echo \"检查BingSiteAuth.xml:\"
    if [ -f \"\$DEPLOY_DIR/BingSiteAuth.xml\" ]; then
        echo \"✅ BingSiteAuth.xml 已保留\"
    else
        echo \"⚠️ BingSiteAuth.xml 不存在（可能是首次部署）\"
    fi
    echo \"\"
    echo \"检查 HSNPM 服务:\"
    # 检查 systemd 服务
    if systemctl is-active --quiet hsnpm-notification.service 2>/dev/null; then
        echo \"✅ HSNPM systemd 服务正在运行\"
        systemctl status hsnpm-notification.service --no-pager | head -5
    elif pgrep -f \"hsnpm-notification-service\" > /dev/null; then
        echo \"✅ HSNPM 进程正在运行（非 systemd 方式）\"
        ps aux | grep \"hsnpm-notification-service\" | grep -v grep | head -2
    else
        echo \"❌ HSNPM 服务未运行\"
        echo \"尝试启动 HSNPM...\"
        if [ -f \"\$DEPLOY_DIR/hsnpm/start.sh\" ]; then
            cd \"\$DEPLOY_DIR/hsnpm\" && chmod +x start.sh && ./start.sh
            sleep 2
            if pgrep -f \"hsnpm-notification-service\" > /dev/null; then
                echo \"✅ HSNPM 已通过启动脚本启动\"
            else
                echo \"❌ HSNPM 启动失败\"
            fi
        fi
    fi
    echo \"\"
    echo \"检查 APK 文件:\"
    if [ -d \"\$DEPLOY_DIR/apps\" ]; then
        echo \"📱 APK 目录内容:\"
        ls -la \"\$DEPLOY_DIR/apps/\"
    else
        echo \"⚠️  APK 目录不存在\"
    fi
    echo \"\"
    echo \"检查 HSNPM 健康状态:\"
    if curl -f -s http://localhost:3030/health >/dev/null 2>&1; then
        echo \"✅ HSNPM 健康检查通过\"
    else
        echo \"⚠️  HSNPM 健康检查失败\"
    fi
"