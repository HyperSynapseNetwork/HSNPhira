#!/bin/bash
# 部署脚本 - 将构建产物部署到远程服务器并安全重启 HSNPM

set -e

# 参数检查
if [ $# -lt 4 ]; then
    echo "用法: $0 <DEPLOY_USER> <SERVER_HOST> <SSH_PASSWORD> <DEPLOY_DIR>"
    exit 1
fi

DEPLOY_USER="$1"
SERVER_HOST="$2"
SSH_PASSWORD="$3"
DEPLOY_DIR="$4"

echo "开始部署到服务器: $DEPLOY_USER@$SERVER_HOST"

# 1. 本地准备：创建临时目录并整理文件
mkdir -p deploy_temp
cp -r dist/* deploy_temp/

echo "整理 HSNPM 通知服务文件..."
mkdir -p deploy_temp/hsnpm
mkdir -p deploy_temp/hsnpm/systemd

# 复制 HSNPM 二进制文件 (注意你的文件名是 hsnpm-notification-service)
if [ -f "HSNPM/target/release/hsnpm-notification-service" ]; then
    cp HSNPM/target/release/hsnpm-notification-service deploy_temp/hsnpm/
    chmod +x deploy_temp/hsnpm/hsnpm-notification-service
fi

# 复制配置文件和启动脚本
[ -f "HSNPM/.env" ] && cp HSNPM/.env deploy_temp/hsnpm/
[ -f "scripts/deploy-hsnpm-start.sh" ] && cp scripts/deploy-hsnpm-start.sh deploy_temp/hsnpm/start.sh
[ -f "scripts/deploy-hsnpm-systemd.service" ] && cp scripts/deploy-hsnpm-systemd.service deploy_temp/hsnpm/systemd/hsnpm-notification.service

# 2. 压缩产物
tar -czf deploy.tar.gz -C deploy_temp .

# 3. 传输到服务器
echo "传输文件到服务器..."
sshpass -p "$SSH_PASSWORD" scp -o StrictHostKeyChecking=accept-new deploy.tar.gz "$DEPLOY_USER@$SERVER_HOST:/tmp/deploy.tar.gz"

# 4. 远程部署逻辑
echo "在服务器上执行原子替换与服务重启..."
sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=accept-new "$DEPLOY_USER@$SERVER_HOST" "
    # 设置 sudo 命令
    SUDO=\"sudo\"
    [ \"\$(whoami)\" = \"root\" ] && SUDO=\"\"
    
    DEPLOY_DIR=\"$DEPLOY_DIR\"
    TMP_DIR=\"/tmp/deploy_\$(date +%s)\"
    SERVICE_NAME=\"hsnpm-notification.service\"

    echo \"创建临时目录并解压...\"
    mkdir -p \"\$TMP_DIR\"
    tar -xzf /tmp/deploy.tar.gz -C \"\$TMP_DIR\"

    # --- 关键修复：处理运行中的 HSNPM ---
    echo \"停止旧服务以释放文件锁...\"
    \$SUDO systemctl stop \$SERVICE_NAME 2>/dev/null || true
    
    # 强制兜底：如果 systemctl 没杀掉，使用 pkill
    \$SUDO pkill -f hsnpm-notification-service 2>/dev/null || true

    # 备份现有 BingSiteAuth.xml
    if [ -f \"\$DEPLOY_DIR/BingSiteAuth.xml\" ]; then
        cp \"\$DEPLOY_DIR/BingSiteAuth.xml\" \"\$TMP_DIR/BingSiteAuth.xml\"
    fi

    echo \"清理旧文件并部署新文件...\"
    # 保留目录结构，清空内容（避开 BingSiteAuth.xml）
    find \"\$DEPLOY_DIR\" -mindepth 1 -maxdepth 1 -not -name \"BingSiteAuth.xml\" -exec rm -rf {} +
    cp -r \"\$TMP_DIR\"/* \"\$DEPLOY_DIR\"/

    echo \"配置权限...\"
    chmod -R 755 \"\$DEPLOY_DIR\"
    # 尝试设置用户，如果失败则跳过
    \$SUDO chown -R www-data:www-data \"\$DEPLOY_DIR\" 2>/dev/null || true

    # --- systemd 服务重载与启动 ---
    if [ -f \"\$DEPLOY_DIR/hsnpm/systemd/hsnpm-notification.service\" ]; then
        echo \"更新 systemd 配置...\"
        \$SUDO cp \"\$DEPLOY_DIR/hsnpm/systemd/\$SERVICE_NAME\" \"/etc/systemd/system/\$SERVICE_NAME\"
        \$SUDO systemctl daemon-reload
        \$SUDO systemctl enable \$SERVICE_NAME
        
        echo \"启动 HSNPM 服务...\"
        \$SUDO systemctl start \$SERVICE_NAME
        
        # 检查是否成功启动
        sleep 2
        if \$SUDO systemctl is-active --quiet \$SERVICE_NAME; then
            echo \"✅ HSNPM 服务启动成功\"
        else
            echo \"❌ HSNPM 服务启动失败，请检查日志\"
            \$SUDO journalctl -u \$SERVICE_NAME -n 20 --no-pager
            exit 1
        fi
    fi

    echo \"清理临时文件...\"
    rm -rf \"\$TMP_DIR\"
    rm -f /tmp/deploy.tar.gz
    echo \"✨ 服务器部署完成！\"
"

# 5. 本地清理
rm -rf deploy_temp deploy.tar.gz
echo "✅ 本地清理完成，流程结束。"
