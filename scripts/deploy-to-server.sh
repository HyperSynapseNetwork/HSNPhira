#!/bin/bash
# 部署脚本 - 将构建产物部署到远程服务器

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

echo "开始部署到服务器..."
echo "服务器: $DEPLOY_USER@$SERVER_HOST"
echo "目标目录: $DEPLOY_DIR"

# 创建临时目录并压缩构建产物
mkdir -p deploy_temp
cp -r dist/* deploy_temp/

# 添加 HSNPM 通知服务
echo "添加 HSNPM 通知服务文件..."
mkdir -p deploy_temp/hsnpm

# 复制 HSNPM 二进制文件
if [ -f "HSNPM/target/release/hsnpm-notification-service" ]; then
    cp HSNPM/target/release/hsnpm-notification-service deploy_temp/hsnpm/
    chmod +x deploy_temp/hsnpm/hsnpm-notification-service
    echo "✅ HSNPM 二进制文件已添加"
fi

# 复制 HSNPM 配置文件
if [ -f "HSNPM/.env" ]; then
    cp HSNPM/.env deploy_temp/hsnpm/
    echo "✅ HSNPM 配置文件已添加"
fi

# 复制 HSNPM README 和文档
if [ -f "HSNPM/README.md" ]; then
    cp HSNPM/README.md deploy_temp/hsnpm/
fi

# 复制预定义的启动脚本
if [ -f "scripts/deploy-hsnpm-start.sh" ]; then
    cp scripts/deploy-hsnpm-start.sh deploy_temp/hsnpm/start.sh
    chmod +x deploy_temp/hsnpm/start.sh
    echo "✅ HSNPM 启动脚本已添加"
fi

# 创建 systemd 服务文件目录
echo "🔧 创建 systemd 服务文件..."
mkdir -p deploy_temp/hsnpm/systemd

if [ -f "scripts/deploy-hsnpm-systemd.service" ]; then
    cp scripts/deploy-hsnpm-systemd.service deploy_temp/hsnpm/systemd/hsnpm-notification.service
    echo "✅ systemd 服务文件已创建"
fi

# 复制 APK 文件到部署目录
echo "📱 复制 APK 文件..."
if [ -d "dist/apps" ] && [ "$(ls -A dist/apps 2>/dev/null)" ]; then
    mkdir -p deploy_temp/apps
    cp -r dist/apps/* deploy_temp/apps/
    echo "✅ APK 文件已复制到 deploy_temp/apps/"
    ls -la deploy_temp/apps/
else
    echo "⚠️  dist/apps 目录为空或不存在，跳过 APK 复制"
fi

# 检查并备份 BingSiteAuth.xml（使用 sshpass）
if sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=accept-new "$DEPLOY_USER@$SERVER_HOST" "[ -f $DEPLOY_DIR/BingSiteAuth.xml ]"; then
    echo "检测到BingSiteAuth.xml，将保留此文件"
    sshpass -p "$SSH_PASSWORD" scp -o StrictHostKeyChecking=accept-new "$DEPLOY_USER@$SERVER_HOST:$DEPLOY_DIR/BingSiteAuth.xml" deploy_temp/BingSiteAuth.xml 2>/dev/null || echo "无法获取BingSiteAuth.xml，将使用现有版本"
fi

# 压缩文件
tar -czf deploy.tar.gz -C deploy_temp .

# 传输 tar 包到服务器
echo "传输文件到服务器..."
sshpass -p "$SSH_PASSWORD" scp -o StrictHostKeyChecking=accept-new deploy.tar.gz "$DEPLOY_USER@$SERVER_HOST:/tmp/deploy.tar.gz"

# 远程执行部署
echo "在服务器上解压并部署..."
sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=accept-new "$DEPLOY_USER@$SERVER_HOST" "
    DEPLOY_DIR=\"$DEPLOY_DIR\"
    TMP_DIR=\"/tmp/deploy_\$(date +%s)\"

    echo \"创建临时目录: \$TMP_DIR\"
    mkdir -p \"\$TMP_DIR\"

    echo \"解压文件...\"
    tar -xzf /tmp/deploy.tar.gz -C \"\$TMP_DIR\"

    # 备份现有 BingSiteAuth.xml
    if [ -f \"\$DEPLOY_DIR/BingSiteAuth.xml\" ]; then
        echo \"备份BingSiteAuth.xml...\"
        cp \"\$DEPLOY_DIR/BingSiteAuth.xml\" \"\$TMP_DIR/BingSiteAuth.xml\"
    fi

    echo \"清理目标目录（保留BingSiteAuth.xml）...\"
    find \"\$DEPLOY_DIR\" -mindepth 1 -maxdepth 1 \\
        -not -name \"BingSiteAuth.xml\" \\
        -exec rm -rf {} + 2>/dev/null || true

    echo \"复制新文件...\"
    cp -r \"\$TMP_DIR\"/* \"\$DEPLOY_DIR\"/

    echo \"设置权限...\"
    chmod -R 755 \"\$DEPLOY_DIR\"
    chown -R www-data:www-data \"\$DEPLOY_DIR\" 2>/dev/null || echo \"无法更改所有者，继续...\"

    # 配置 HSNPM systemd 服务
    echo \"🔧 配置 HSNPM systemd 服务...\"
    SYSTEMD_DIR=\"/etc/systemd/system\"
    SERVICE_FILE=\"\$SYSTEMD_DIR/hsnpm-notification.service\"

    if [ -f \"\$DEPLOY_DIR/hsnpm/systemd/hsnpm-notification.service\" ]; then
        echo \"复制 systemd 服务文件...\"
        cp \"\$DEPLOY_DIR/hsnpm/systemd/hsnpm-notification.service\" \"\$SERVICE_FILE\"

        # 重载 systemd 配置
        systemctl daemon-reload

        # 启用服务（开机自启）
        if systemctl enable hsnpm-notification.service; then
            echo \"✅ HSNPM systemd 服务已启用\"
        else
            echo \"⚠️  无法启用 HSNPM systemd 服务，可能 systemd 不可用\"
        fi

        # 启动或重启服务
        if systemctl is-active --quiet hsnpm-notification.service; then
            echo \"重启 HSNPM 服务...\"
            systemctl restart hsnpm-notification.service
        else
            echo \"启动 HSNPM 服务...\"
            systemctl start hsnpm-notification.service
        fi

        # 检查服务状态
        sleep 3
        systemctl status hsnpm-notification.service --no-pager || echo \"⚠️  服务状态检查失败\"
    else
        echo \"⚠️  systemd 服务文件不存在，跳过 systemd 配置\"
    fi

    echo \"清理临时文件...\"
    rm -rf \"\$TMP_DIR\"
    rm -f /tmp/deploy.tar.gz

    echo \"部署完成！\"
    ls -la \"\$DEPLOY_DIR\" | head -20
"

# 清理本地临时文件
rm -rf deploy_temp deploy.tar.gz
echo "✅ 部署完成！"