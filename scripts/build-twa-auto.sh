#!/bin/bash

# HSNPhira TWA 自动化构建脚本
# 支持自动版本管理、GitHub Secrets 集成

set -e

echo "🚀 开始自动化构建 HSNPhira TWA Android 应用"

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$PROJECT_ROOT/dist"
TWA_DIR="$PROJECT_ROOT/twa"
APPS_DIR="$DIST_DIR/apps"

# 检查必要的工具
if ! command -v java &> /dev/null; then
    echo "❌ Java 未安装，请安装 Java 11+"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装，请安装 Node.js"
    exit 1
fi

# 检查 bubblewrap 是否已安装
if ! npm list -g @bubblewrap/cli &> /dev/null 2>/dev/null; then
    echo "📦 安装 bubblewrap CLI..."
    npm install -g @bubblewrap/cli
fi

# 确保 dist 目录存在（先构建前端）
if [ ! -d "$DIST_DIR" ]; then
    echo "📦 构建前端应用..."
    npm run build
fi

# 设置环境变量确保 bubblewrap 非交互式运行
export BUBBLEWRAP_YES=1
export BUBBLEWRAP_NON_INTERACTIVE=1

# 确保 JAVA_HOME 已设置（用于 bubblewrap）
if [ -z "$JAVA_HOME" ]; then
    # 尝试从 which java 推断 JAVA_HOME
    JAVA_PATH=$(which java 2>/dev/null || true)
    if [ -n "$JAVA_PATH" ]; then
        # 提取 JAVA_HOME（例如 /usr/bin/java -> /usr）
        JAVA_HOME=$(dirname $(dirname "$JAVA_PATH"))
        echo "⚠️  JAVA_HOME 未设置，推断为: $JAVA_HOME"
        export JAVA_HOME
    else
        echo "❌ Java 未安装，请安装 Java 11+"
        exit 1
    fi
fi
echo "🔧 使用 JAVA_HOME: $JAVA_HOME"

# 创建 TWA 目录
mkdir -p "$TWA_DIR"
mkdir -p "$APPS_DIR"

# 从环境变量获取版本信息
# GitHub Actions 提供 GITHUB_RUN_NUMBER 作为构建号
if [ -n "$GITHUB_RUN_NUMBER" ]; then
    BUILD_NUMBER="$GITHUB_RUN_NUMBER"
    VERSION_NAME="0.0.$BUILD_NUMBER"
    VERSION_CODE="$BUILD_NUMBER"
else
    # 本地构建使用默认值
    BUILD_NUMBER="1"
    VERSION_NAME="0.0.1"
    VERSION_CODE="1"
fi

echo "📱 版本信息:"
echo "  - 构建号: $BUILD_NUMBER"
echo "  - 版本名称: $VERSION_NAME"
echo "  - 版本代码: $VERSION_CODE"

# 检查必要的环境变量（GitHub Secrets）
if [ -z "$TWA_KEYSTORE_BASE64" ] || [ -z "$TWA_KEYSTORE_PASSWORD" ] || \
   [ -z "$TWA_KEY_ALIAS" ] || [ -z "$TWA_KEY_PASSWORD" ]; then
    echo "⚠️  缺少 TWA 密钥配置，使用默认调试密钥"
    echo "⚠️  生产环境请配置 GitHub Secrets:"
    echo "    - TWA_KEYSTORE_BASE64"
    echo "    - TWA_KEYSTORE_PASSWORD"
    echo "    - TWA_KEY_ALIAS"
    echo "    - TWA_KEY_PASSWORD"
    
    # 使用默认密钥构建（仅用于测试）
    if [ ! -f "$TWA_DIR/twa-manifest.json" ]; then
        echo "🛠️  使用默认密钥初始化 bubblewrap 项目..."
        cd "$TWA_DIR"
        echo "n" | bubblewrap init --manifest="$DIST_DIR/manifest.json" --directory="$TWA_DIR" --jdkPath="$JAVA_HOME" --accept-license
    fi
else
    echo "🔐 使用 GitHub Secrets 中的生产密钥"
    
    # 解码密钥库文件（处理可能包含的换行符）
    echo "正在解码 base64 密钥库..."
    # 删除所有换行符，确保 base64 是单行
    CLEAN_BASE64=$(echo "$TWA_KEYSTORE_BASE64" | tr -d '\n' | tr -d ' ')
    echo "清理后的 base64 长度: ${#CLEAN_BASE64} 字符"
    
    # 验证 base64 格式
    if echo "$CLEAN_BASE64" | base64 -d > /dev/null 2>&1; then
        echo "✅ base64 格式有效"
        echo "$CLEAN_BASE64" | base64 -d > "$TWA_DIR/production.keystore"
        echo "✅ 密钥库文件已解码: $TWA_DIR/production.keystore"
    else
        echo "❌ base64 格式无效，无法解码"
        echo "⚠️  使用调试密钥继续构建..."
        # 使用默认密钥构建（仅用于测试）
        if [ ! -f "$TWA_DIR/twa-manifest.json" ]; then
            echo "🛠️  使用默认密钥初始化 bubblewrap 项目..."
            cd "$TWA_DIR"
            echo "n" | bubblewrap init --manifest="$DIST_DIR/manifest.json" --directory="$TWA_DIR" --jdkPath="$JAVA_HOME" --accept-license
        fi
        exit 0
    fi
    
    # 初始化或更新 bubblewrap 项目
    if [ ! -f "$TWA_DIR/twa-manifest.json" ]; then
        echo "🛠️  使用生产密钥初始化 bubblewrap 项目..."
        cd "$TWA_DIR"
        echo "n" | bubblewrap init \
            --manifest="$DIST_DIR/manifest.json" \
            --directory="$TWA_DIR" \
            --keystorePath="production.keystore" \
            --keystorePass="$TWA_KEYSTORE_PASSWORD" \
            --keyPass="$TWA_KEY_PASSWORD" \
            --alias="$TWA_KEY_ALIAS" \
            --jdkPath="$JAVA_HOME" \
            --accept-license
    else
        echo "📁 使用现有的 bubblewrap 项目配置"
        cd "$TWA_DIR"
        
        # 更新密钥库配置
        if [ -f "production.keystore" ]; then
            rm -f "production.keystore"
        fi
        
        # 解码密钥库文件（处理可能包含的换行符）
        echo "更新密钥库配置..."
        # 删除所有换行符，确保 base64 是单行
        CLEAN_BASE64=$(echo "$TWA_KEYSTORE_BASE64" | tr -d '\n' | tr -d ' ')
        echo "清理后的 base64 长度: ${#CLEAN_BASE64} 字符"
        
        # 验证 base64 格式
        if echo "$CLEAN_BASE64" | base64 -d > /dev/null 2>&1; then
            echo "✅ base64 格式有效"
            echo "$CLEAN_BASE64" | base64 -d > "production.keystore"
            echo "✅ 密钥库文件已更新"
        else
            echo "❌ base64 格式无效，无法更新密钥库"
            echo "⚠️  跳过密钥库更新，使用现有文件"
        fi
    fi
fi

# 进入 TWA 目录
cd "$TWA_DIR"

# 更新版本信息
echo "🔄 更新版本信息..."
if command -v jq &> /dev/null; then
    # 使用 jq 更新版本信息
    if [ -f "twa-manifest.json" ]; then
        jq ".versionCode = \"$VERSION_CODE\" | .versionName = \"$VERSION_NAME\"" twa-manifest.json > twa-manifest.json.tmp
        mv twa-manifest.json.tmp twa-manifest.json
        echo "✅ 更新版本: $VERSION_NAME ($VERSION_CODE)"
    fi
else
    # 如果没有 jq，使用 sed（简化版）
    if [ -f "twa-manifest.json" ]; then
        sed -i "s/\"versionCode\": \"[^\"]*\"/\"versionCode\": \"$VERSION_CODE\"/g" twa-manifest.json
        sed -i "s/\"versionName\": \"[^\"]*\"/\"versionName\": \"$VERSION_NAME\"/g" twa-manifest.json
        echo "✅ 更新版本: $VERSION_NAME ($VERSION_CODE)"
    fi
fi

# 更新 manifest（应用名称和包名）
echo "🔄 更新应用配置..."
if [ -f "twa-manifest.json" ] && command -v jq &> /dev/null; then
    jq '.name = "HSNPhira" | .packageId = "com.hypersn.phira"' twa-manifest.json > twa-manifest.json.tmp
    mv twa-manifest.json.tmp twa-manifest.json
fi

# 构建 APK (非交互式，使用环境变量密码)
echo "🔨 构建 APK (非交互式)..."
echo "🔑 使用环境变量: BUBBLEWRAP_KEYSTORE_PASSWORD 和 BUBBLEWRAP_KEY_PASSWORD"
bubblewrap build --skipPwaValidation

# 构建 App Bundle（可选）
echo "🔨 构建 App Bundle..."
bubblewrap build --bundle --skipPwaValidation || echo "⚠️  App Bundle 构建失败，跳过"

# 复制 APK 到 dist/apps 目录
echo "📦 复制 APK 文件..."
if [ -f "app-release-signed.apk" ]; then
    # 创建版本化的文件名
    APK_FILENAME="hsnphira-v$VERSION_NAME.apk"
    LATEST_APK="hsnphira-latest.apk"
    
    cp app-release-signed.apk "$APPS_DIR/$APK_FILENAME"
    cp app-release-signed.apk "$APPS_DIR/$LATEST_APK"
    
    echo "✅ APK 已复制:"
    echo "   - $APPS_DIR/$APK_FILENAME"
    echo "   - $APPS_DIR/$LATEST_APK"
    
    # 记录版本信息
    echo "📝 创建版本信息文件..."
    cat > "$APPS_DIR/version-info.json" << EOF
{
  "versionName": "$VERSION_NAME",
  "versionCode": "$VERSION_CODE",
  "buildNumber": "$BUILD_NUMBER",
  "buildDate": "$(date -Iseconds)",
  "apkFiles": [
    "$APK_FILENAME",
    "$LATEST_APK"
  ]
}
EOF
else
    echo "❌ 未找到构建的 APK 文件"
    exit 1
fi

# 生成数字资产链接文件（如果提供了 SHA256 指纹）
if [ -n "$TWA_SHA256_FINGERPRINT" ]; then
    echo "🔗 生成数字资产链接文件..."
    ASSETLINKS_DIR="$PROJECT_ROOT/public/.well-known"
    mkdir -p "$ASSETLINKS_DIR"
    
    cat > "$ASSETLINKS_DIR/assetlinks.json" << EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "web",
      "site": "https://phira.htadiy.com",
      "sha256_cert_fingerprints": [
        "$TWA_SHA256_FINGERPRINT"
      ]
    }
  }
]
EOF
    
    echo "✅ 数字资产链接文件已生成: $ASSETLINKS_DIR/assetlinks.json"
fi

echo ""
echo "🎉 TWA 自动化构建完成！"
echo ""
echo "📱 版本: $VERSION_NAME (Code: $VERSION_CODE)"
echo "📦 APK 文件:"
echo "   - $APPS_DIR/hsnphira-v$VERSION_NAME.apk"
echo "   - $APPS_DIR/hsnphira-latest.apk"
echo ""
echo "📄 数字资产链接: https://phira.htadiy.com/.well-known/assetlinks.json"
echo ""
echo "🚀 下一步:"
echo "   1. APK 将自动部署到服务器"
echo "   2. 下载页面将自动更新"
echo "   3. 用户可以下载最新版本"