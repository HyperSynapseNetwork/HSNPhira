#!/bin/bash

# HSNPhira WebPush 一键配置脚本
# 生成 VAPID 密钥并配置前后端环境

set -e

echo "🚀 开始配置 HSNPhira WebPush 通知系统"

# 检查必要的工具
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请安装 Node.js"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HSNPM_DIR="$PROJECT_ROOT/HSNPM"

echo "📁 项目根目录: $PROJECT_ROOT"

# 安装 web-push 工具（如果未安装）
if ! npm list -g web-push &> /dev/null; then
    echo "📦 安装 web-push 工具..."
    npm install -g web-push
else
    echo "✅ web-push 工具已安装"
fi

# 检查是否已提供VAPID密钥环境变量
USE_ENV_VARS=false
if [ -n "$VAPID_PUBLIC_KEY" ] && [ -n "$VAPID_PRIVATE_KEY" ]; then
    echo "🔑 检测到环境变量 VAPID 密钥"
    echo "公钥长度: ${#VAPID_PUBLIC_KEY}"
    
    # 验证公钥格式
    if [[ "$VAPID_PUBLIC_KEY" =~ ^[A-Za-z0-9_-]+$ ]] && [ ${#VAPID_PUBLIC_KEY} -eq 87 ]; then
        echo "✅ 环境变量公钥格式正确 (URL-safe base64, 87字符)"
        # 进一步验证公钥内容：确保是有效的未压缩 EC 公钥（第一个字节为 0x04）
        if command -v python3 &> /dev/null; then
            if python3 -c "
import base64, sys
key = '''$VAPID_PUBLIC_KEY'''
key = key.replace('-', '+').replace('_', '/')
try:
    data = base64.b64decode(key + '=' * ((4 - len(key) % 4) % 4))
    if len(data) != 65 or data[0] != 0x04:
        print('INVALID')
        sys.exit(1)
except:
    sys.exit(1)
            " 2>/dev/null; then
                echo "✅ 公钥内容验证通过（有效的未压缩 EC 公钥）"
                USE_ENV_VARS=true
            else
                echo "⚠️  公钥内容无效（不是有效的未压缩 EC 公钥），将从私钥重新生成公钥"
                USE_ENV_VARS=false
            fi
        else
            echo "⚠️  无法验证公钥内容（python3 不可用），假定公钥有效"
            USE_ENV_VARS=true
        fi
    else
        echo "⚠️  环境变量公钥格式不正确，将生成新密钥"
        echo "⚠️  期望: 87字符 URL-safe base64 (仅包含字母、数字、-、_)"
        echo "⚠️  实际: ${#VAPID_PUBLIC_KEY}字符"
    fi
fi

if [ "$USE_ENV_VARS" = false ]; then
    # 公钥无效或未提供，但私钥可能有效
    if [ -n "$VAPID_PRIVATE_KEY" ]; then
        echo "🔑 公钥无效但私钥存在，尝试从私钥生成有效公钥..."
        # 尝试从私钥提取公钥
        TEMP_DIR=$(mktemp -d)
        cd "$TEMP_DIR"
        
        # 将私钥写入文件
        echo "$VAPID_PRIVATE_KEY" > private_key.pem
        
        # 检查私钥是否为有效的 PEM 格式
        if openssl ec -in private_key.pem -check 2>/dev/null; then
            echo "✅ 私钥格式有效，正在生成公钥..."
            # 提取公钥（未压缩点坐标）
            VAPID_PUBLIC_KEY=$(openssl ec -in private_key.pem -pubout -outform DER 2>/dev/null | tail -c 65 | base64 -w 0 2>/dev/null || openssl ec -in private_key.pem -pubout -outform DER 2>/dev/null | tail -c 65 | base64 | tr -d '\n')
            # 转换为URL-safe base64
            VAPID_PUBLIC_KEY=$(echo "$VAPID_PUBLIC_KEY" | tr '+' '-' | tr '/' '_' | sed 's/=*$//')
            
            if [ -n "$VAPID_PUBLIC_KEY" ] && [ ${#VAPID_PUBLIC_KEY} -eq 87 ]; then
                echo "✅ 成功从私钥生成有效公钥"
                echo "✅ 生成的 VAPID 公钥: ${VAPID_PUBLIC_KEY:0:20}..."
                echo "✅ 使用现有的 VAPID 私钥"
                cd "$PROJECT_ROOT"
                rm -rf "$TEMP_DIR"
                USE_ENV_VARS=true
            else
                echo "⚠️  无法从私钥生成有效公钥，将生成全新密钥对"
                cd "$PROJECT_ROOT"
                rm -rf "$TEMP_DIR"
                # 继续生成新密钥
            fi
        else
            echo "⚠️  私钥格式无效，将生成全新密钥对"
            cd "$PROJECT_ROOT"
            rm -rf "$TEMP_DIR"
        fi
    fi
    
    # 如果仍然没有有效的公钥/私钥对，生成全新的密钥对
    if [ "$USE_ENV_VARS" = false ]; then
        echo "🔑 生成新的 VAPID 密钥..."
        KEYS_OUTPUT=$(web-push generate-vapid-keys 2>&1)

        # 提取公钥和私钥
        VAPID_PUBLIC_KEY=$(echo "$KEYS_OUTPUT" | grep -oP 'Public Key:\s*\K[^ \n]*' | head -1)
        VAPID_PRIVATE_KEY=$(echo "$KEYS_OUTPUT" | grep -oP 'Private Key:\s*\K[^ \n]*' | head -1)

        # 确保公钥是URL-safe base64格式（替换+为-，/为_，删除填充=）
        if [ -n "$VAPID_PUBLIC_KEY" ]; then
            VAPID_PUBLIC_KEY=$(echo "$VAPID_PUBLIC_KEY" | tr '+' '-' | tr '/' '_' | sed 's/=*$//')
        fi

        if [ -z "$VAPID_PUBLIC_KEY" ] || [ -z "$VAPID_PRIVATE_KEY" ]; then
            echo "❌ 无法提取 VAPID 密钥，尝试其他方式..."
            # 尝试手动生成
            TEMP_DIR=$(mktemp -d)
            cd "$TEMP_DIR"

            # 生成 ECDSA 密钥对
            openssl ecparam -genkey -name prime256v1 -out private_key.pem 2>/dev/null || {
                echo "❌ OpenSSL 未安装或生成密钥失败"
                exit 1
            }

            # 提取私钥（PEM格式）
            VAPID_PRIVATE_KEY=$(cat private_key.pem)

            # 提取公钥（Base64格式）并转换为URL-safe base64
            # 提取未压缩点坐标（最后65字节）并直接base64编码
            VAPID_PUBLIC_KEY=$(openssl ec -in private_key.pem -pubout -outform DER 2>/dev/null | tail -c 65 | base64 -w 0 2>/dev/null || openssl ec -in private_key.pem -pubout -outform DER 2>/dev/null | tail -c 65 | base64 | tr -d '\n')
            # 转换为URL-safe base64
            VAPID_PUBLIC_KEY=$(echo "$VAPID_PUBLIC_KEY" | tr '+' '-' | tr '/' '_' | sed 's/=*$//')

            cd "$PROJECT_ROOT"
            rm -rf "$TEMP_DIR"
        fi

        if [ -z "$VAPID_PUBLIC_KEY" ] || [ -z "$VAPID_PRIVATE_KEY" ]; then
            echo "❌ 生成 VAPID 密钥失败"
            exit 1
        fi

        echo "✅ 新生成的 VAPID 公钥: ${VAPID_PUBLIC_KEY:0:20}..."
        echo "✅ 新生成的 VAPID 私钥: ${VAPID_PRIVATE_KEY:0:50}..."
    fi
else
    echo "✅ 使用环境变量中的 VAPID 密钥"
    echo "✅ VAPID 公钥: ${VAPID_PUBLIC_KEY:0:20}..."
    echo "✅ VAPID 私钥: ${VAPID_PRIVATE_KEY:0:50}..."
fi

# 配置 HSNPM 后端
echo "⚙️  配置 HSNPM 后端..."
if [ ! -d "$HSNPM_DIR" ]; then
    echo "📁 创建 HSNPM 目录..."
    mkdir -p "$HSNPM_DIR"
fi

# 创建或更新 HSNPM .env 文件
HSNPM_ENV="$HSNPM_DIR/.env"
if [ -f "$HSNPM_ENV" ]; then
    echo "📄 更新现有的 HSNPM .env 文件..."
    # 备份原文件
    cp "$HSNPM_ENV" "$HSNPM_ENV.backup.$(date +%s)"
else
    echo "📄 创建新的 HSNPM .env 文件..."
    # 从示例文件创建
    if [ -f "$HSNPM_DIR/.env.example" ]; then
        cp "$HSNPM_DIR/.env.example" "$HSNPM_ENV"
    fi
fi

# 更新环境变量
# 使用 sed 或直接写入
cat > "$HSNPM_ENV" << EOF
# HSNPM 通知服务环境变量配置
# 自动生成于 $(date)

# 服务器端口
PORT=3030

# VAPID 密钥（用于 Web-Push）
VAPID_PRIVATE_KEY="$VAPID_PRIVATE_KEY"
VAPID_PUBLIC_KEY="$VAPID_PUBLIC_KEY"
VAPID_SUBJECT="mailto:hsnphira@hyper-sn.com"

# 远程 Phira 服务器地址（用于监听房间事件）
REMOTE_PHIRA_SERVER="https://phira.htadiy.com"

# 日志级别
RUST_LOG="info"
EOF

echo "✅ HSNPM 后端配置完成"

# 配置前端环境变量
echo "⚙️  配置前端环境变量..."

# 创建生产环境配置文件
FRONTEND_ENV="$PROJECT_ROOT/.env.production"
if [ ! -f "$FRONTEND_ENV" ]; then
    echo "📄 创建 .env.production 文件..."
    # 从开发环境复制基础配置
    if [ -f "$PROJECT_ROOT/.env.development" ]; then
        grep -v "VITE_VAPID_PUBLIC_KEY" "$PROJECT_ROOT/.env.development" > "$FRONTEND_ENV"
    fi
fi

# 添加或更新 VAPID 公钥
if grep -q "VITE_VAPID_PUBLIC_KEY" "$FRONTEND_ENV"; then
    # 更新现有值
    sed -i "s|VITE_VAPID_PUBLIC_KEY=.*|VITE_VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY|" "$FRONTEND_ENV"
else
    # 添加新行
    echo "" >> "$FRONTEND_ENV"
    echo "# WebPush VAPID 公钥" >> "$FRONTEND_ENV"
    echo "VITE_VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY" >> "$FRONTEND_ENV"
fi

# 确保 HSNPM 服务器地址正确（生产环境）
if grep -q "VITE_HSNPM_SERVER" "$FRONTEND_ENV"; then
    # 更新为生产环境地址（假设 HSNPM 与前端同域）
    sed -i "s|VITE_HSNPM_SERVER=.*|VITE_HSNPM_SERVER=/hsnpm-api|" "$FRONTEND_ENV"
else
    echo "VITE_HSNPM_SERVER=/hsnpm-api" >> "$FRONTEND_ENV"
fi

echo "✅ 前端环境配置完成"


# 创建部署配置说明
echo "📋 创建部署说明..."
DEPLOY_README="$PROJECT_ROOT/DEPLOY-WEBPUSH.md"
cat > "$DEPLOY_README" << 'EOF'
# HSNPhira WebPush 通知系统部署指南

## 配置说明

已自动配置以下组件：

### 1. HSNPM 后端服务
- 位置: `HSNPM/`
- 配置文件: `HSNPM/.env`
- 监听端口: 3030
- 远程 SSE 源: https://phira.htadiy.com
- VAPID 密钥: 已自动生成

### 2. 前端环境变量
- 生产环境: `.env.production`
- 开发环境: `.env.development` (需手动添加 VAPID 公钥)
- VAPID 公钥: 已配置到生产环境

## 部署步骤

### 方案 A: 一体化部署（推荐）

1. **构建前端**:
   ```bash
   pnpm run build:ssg
   ```

2. **构建 HSNPM 服务**:
   ```bash
   cd HSNPM
   cargo build --release
   ```

3. **部署文件结构**:
   ```
   /www/wwwroot/phira.htadiy.com/
   ├── index.html
   ├── assets/
   └── hsnpm/ (HSNPM 二进制和配置)
   ```

4. **配置反向代理**:
   ```nginx
   # 前端静态文件
   location / {
       root /www/wwwroot/phira.htadiy.com;
       try_files $uri $uri/ /index.html;
   }

   # HSNPM 服务代理
   location /hsnpm-api/ {
       proxy_pass http://localhost:3030/;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
   }
   ```

### 方案 B: 分离部署

1. **前端部署**: 将 `dist/` 目录内容部署到 Web 服务器
2. **HSNPM 部署**: 将编译后的二进制部署到独立服务器
3. **更新前端配置**: 修改 `.env.production` 中的 `VITE_HSNPM_SERVER` 为实际地址

## 验证步骤

1. **前端检查**:
   - 访问 https://phira.htadiy.com
   - 打开浏览器控制台，检查 Service Worker 是否注册成功
   - 测试 WebPush 订阅功能

2. **HSNPM 检查**:
   - 访问 http://your-server:3030/health
   - 应返回 "OK"
   - 检查日志是否成功连接远程 SSE

## 故障排除

### 问题1: WebPush 订阅失败
- 检查 VAPID 公钥是否前后端一致
- 检查浏览器是否支持 Push API
- 检查是否已授予通知权限

### 问题2: HSNPM 无法连接远程 SSE
- 检查网络连接
- 检查远程服务器地址是否正确
- 查看 HSNPM 日志

## 安全注意事项

1. **保护 VAPID 私钥**: 私钥应保密，不要提交到代码仓库
2. **HTTPS 要求**: WebPush 必须使用 HTTPS
3. **权限管理**: 仅向授权用户发送推送通知
4. **日志保护**: 保护服务日志，避免泄露敏感信息

## 更新密钥

如果需要更新 VAPID 密钥:

1. 运行配置脚本重新生成:
   ```bash
   ./scripts/setup-webpush.sh
   ```

2. 重新部署前后端

3. 通知用户重新订阅（旧订阅将失效）

---

**自动生成于:** $(date)
EOF

echo "✅ 部署说明已生成: $DEPLOY_README"

echo ""
echo "🎉 WebPush 配置完成！"
echo ""
echo "📋 下一步:"
echo "  1. 检查生成的配置文件"
echo "  2. 部署到生产环境"
echo "  3. 测试通知功能"
echo ""
echo "🔑 VAPID 公钥 (前 30 字符): ${VAPID_PUBLIC_KEY:0:30}..."
echo ""
echo "⚠️  注意: VAPID 私钥已保存到 HSNPM/.env，请勿泄露！"