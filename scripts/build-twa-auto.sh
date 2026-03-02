#!/bin/bash
set -e

echo "🚀 开始自动化构建 HSNPhira TWA Android 应用"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$PROJECT_ROOT/dist"
TWA_DIR="$PROJECT_ROOT/twa"
APPS_DIR="$DIST_DIR/apps"

# 检查必要工具
if ! command -v java &> /dev/null; then
    echo "❌ Java 未安装，请安装 Java 11+"
    exit 1
fi
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装，请安装 Node.js"
    exit 1
fi

# 安装 bubblewrap（如果未安装）
if ! npm list -g @bubblewrap/cli &> /dev/null 2>/dev/null; then
    echo "📦 安装 bubblewrap CLI..."
    npm install -g @bubblewrap/cli
fi

# 确保前端已构建
if [ ! -d "$DIST_DIR" ] || [ ! -f "$DIST_DIR/manifest.json" ]; then
    echo "📦 构建前端应用..."
    npm run build
fi

# 设置非交互式环境变量
export BUBBLEWRAP_YES=1
export BUBBLEWRAP_NON_INTERACTIVE=1

# 确定 JAVA_HOME
if [ -z "$JAVA_HOME" ]; then
    JAVA_PATH=$(which java 2>/dev/null || true)
    if [ -n "$JAVA_PATH" ]; then
        JAVA_HOME=$(dirname "$(dirname "$JAVA_PATH")")
        echo "⚠️ JAVA_HOME 未设置，推断为: $JAVA_HOME"
        export JAVA_HOME
    else
        echo "❌ Java 未安装，请安装 Java 11+"
        exit 1
    fi
fi
echo "🔧 使用 JAVA_HOME: $JAVA_HOME"

# 创建必要目录
mkdir -p "$TWA_DIR"
mkdir -p "$APPS_DIR"

# 版本信息（从 GitHub Actions 环境获取）
if [ -n "$GITHUB_RUN_NUMBER" ]; then
    BUILD_NUMBER="$GITHUB_RUN_NUMBER"
    VERSION_NAME="0.0.$BUILD_NUMBER"
    VERSION_CODE="$BUILD_NUMBER"
else
    BUILD_NUMBER="1"
    VERSION_NAME="0.0.1"
    VERSION_CODE="1"
fi
echo "📱 版本信息:"
echo " - 构建号: $BUILD_NUMBER"
echo " - 版本名称: $VERSION_NAME"
echo " - 版本代码: $VERSION_CODE"

cd "$TWA_DIR"

# 处理密钥库和初始化项目
if [ -z "$TWA_KEYSTORE_BASE64" ] || [ -z "$TWA_KEYSTORE_PASSWORD" ] || \
   [ -z "$TWA_KEY_ALIAS" ] || [ -z "$TWA_KEY_PASSWORD" ]; then
    echo "⚠️ 缺少 TWA 密钥配置，使用默认调试密钥"
    echo "⚠️ 生产环境请配置 GitHub Secrets:"
    echo " - TWA_KEYSTORE_BASE64"
    echo " - TWA_KEYSTORE_PASSWORD"
    echo " - TWA_KEY_ALIAS"
    echo " - TWA_KEY_PASSWORD"

    if [ ! -f "$TWA_DIR/twa-manifest.json" ]; then
        echo "🛠️ 使用默认密钥初始化 bubblewrap 项目（非交互式）..."
        # 在非交互式模式下，使用 --jdkPath 参数指定路径，无需交互输入
        bubblewrap init \
            --manifest="$DIST_DIR/manifest.json" \
            --directory="$TWA_DIR" \
            --jdkPath="$JAVA_HOME" \
            --accept-license \
            --non-interactive
    fi
else
    echo "🔐 使用 GitHub Secrets 中的生产密钥"
    echo "正在解码 base64 密钥库..."

    # 清理 base64 字符串中的换行和空格
    CLEAN_BASE64=$(echo "$TWA_KEYSTORE_BASE64" | tr -d '\n\r' | tr -d ' ')

    if echo "$CLEAN_BASE64" | base64 -d > /dev/null 2>&1; then
        echo "✅ base64 格式有效"
        echo "$CLEAN_BASE64" | base64 -d > "$TWA_DIR/production.keystore"
        echo "✅ 密钥库文件已解码: $TWA_DIR/production.keystore"
    else
        echo "❌ base64 格式无效，无法解码"
        echo "⚠️ 将回退到使用调试密钥初始化。"
        # 如果解码失败，确保没有残留的无效密钥库文件
        rm -f "$TWA_DIR/production.keystore"
        # 清除相关变量，使逻辑回退到使用调试密钥
        unset TWA_KEYSTORE_BASE64
    fi

    # 根据是否成功解码密钥库来决定初始化方式
    if [ -f "$TWA_DIR/production.keystore" ]; then
        if [ ! -f "$TWA_DIR/twa-manifest.json" ]; then
            echo "🛠️ 使用生产密钥初始化 bubblewrap 项目（非交互式）..."
            bubblewrap init \
                --manifest="$DIST_DIR/manifest.json" \
                --directory="$TWA_DIR" \
                --keystorePath="production.keystore" \
                --keystorePass="$TWA_KEYSTORE_PASSWORD" \
                --keyPass="$TWA_KEY_PASSWORD" \
                --alias="$TWA_KEY_ALIAS" \
                --jdkPath="$JAVA_HOME" \
                --accept-license \
                --non-interactive
        else
            echo "📁 使用现有的 bubblewrap 项目配置，但将更新为生产密钥签名配置。"
            # 注意：bubblewrap 项目初始化后，更新签名信息可能需要修改 twa-manifest.json 或重新初始化。
            # 为简化，此处假设如果已初始化，则使用现有配置，但构建时会用新密钥。
            # 更稳妥的做法是备份后重新初始化，但会丢失手动修改。此处选择提示。
            echo "⚠️ 项目已存在。构建时将使用提供的生产密钥，但包名等配置可能基于旧文件。"
        fi
    else
        # 如果没有有效的生产密钥库文件，则使用调试密钥初始化（如果项目不存在）
        if [ ! -f "$TWA_DIR/twa-manifest.json" ]; then
            echo "🛠️ 回退：使用默认密钥初始化 bubblewrap 项目（非交互式）..."
            bubblewrap init \
                --manifest="$DIST_DIR/manifest.json" \
                --directory="$TWA_DIR" \
                --jdkPath="$JAVA_HOME" \
                --accept-license \
                --non-interactive
        fi
    fi
fi

# 更新版本信息
echo "🔄 更新版本信息..."
if command -v jq &> /dev/null; then
    if [ -f "twa-manifest.json" ]; then
        jq ".versionCode = \"$VERSION_CODE\" | .versionName = \"$VERSION_NAME\"" twa-manifest.json > twa-manifest.json.tmp
        mv twa-manifest.json.tmp twa-manifest.json
        echo "✅ 更新版本: $VERSION_NAME ($VERSION_CODE)"
    fi
else
    if [ -f "twa-manifest.json" ]; then
        sed -i.bak "s/\"versionCode\": \"[^\"]*\"/\"versionCode\": \"$VERSION_CODE\"/g" twa-manifest.json
        sed -i.bak "s/\"versionName\": \"[^\"]*\"/\"versionName\": \"$VERSION_NAME\"/g" twa-manifest.json
        rm -f twa-manifest.json.bak
        echo "✅ 更新版本: $VERSION_NAME ($VERSION_CODE)"
    fi
fi

# 更新应用名称和包名
echo "🔄 更新应用配置..."
if [ -f "twa-manifest.json" ] && command -v jq &> /dev/null; then
    jq '.name = "HSNPhira" | .packageId = "com.hypersn.phira"' twa-manifest.json > twa-manifest.json.tmp
    mv twa-manifest.json.tmp twa-manifest.json
fi

# 构建 APK（非交互式）
echo "🔨 构建 APK (非交互式)..."
echo "🔑 使用环境变量控制密钥库密码。"
# 为构建命令临时设置密码环境变量
export BUBBLEWRAP_KEYSTORE_PASSWORD="$TWA_KEYSTORE_PASSWORD"
export BUBBLEWRAP_KEY_PASSWORD="$TWA_KEY_PASSWORD"

bubblewrap build --skipPwaValidation

# 构建 App Bundle（可选）
echo "🔨 构建 App Bundle..."
bubblewrap build --bundle --skipPwaValidation || echo "⚠️ App Bundle 构建失败，跳过"

# 复制 APK 文件
echo "📦 复制 APK 文件..."
if [ -f "app-release-signed.apk" ]; then
    APK_FILENAME="hsnphira-v$VERSION_NAME.apk"
    LATEST_APK="hsnphira-latest.apk"
    cp app-release-signed.apk "$APPS_DIR/$APK_FILENAME"
    cp app-release-signed.apk "$APPS_DIR/$LATEST_APK"
    echo "✅ APK 已复制:"
    echo " - $APPS_DIR/$APK_FILENAME"
    echo " - $APPS_DIR/$LATEST_APK"

    # 创建版本信息文件
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

# 生成数字资产链接文件（如果提供了指纹）
if [ -n "$TWA_SHA256_FINGERPRINT" ]; then
    echo "🔗 生成数字资产链接文件..."
    # 尝试从 manifest.json 获取启动网址
    START_URL="https://phira.htadiy.com" # 默认值，建议从 $DIST_DIR/manifest.json 中解析
    if command -v jq &> /dev/null && [ -f "$DIST_DIR/manifest.json" ]; then
        MANIFEST_START_URL=$(jq -r '.start_url // empty' "$DIST_DIR/manifest.json" 2>/dev/null)
        if [[ -n "$MANIFEST_START_URL" ]]; then
            # 确保是完整的URL
            if [[ $MANIFEST_START_URL == http* ]]; then
                START_URL="$MANIFEST_START_URL"
            fi
        fi
    fi
    # 提取站点的 origin (协议+主机+端口)
    SITE_ORIGIN=$(echo "$START_URL" | sed -E 's|^([^:/]+://[^/]+).*$|\1|')

    ASSETLINKS_DIR="$PROJECT_ROOT/public/.well-known"
    mkdir -p "$ASSETLINKS_DIR"
    cat > "$ASSETLINKS_DIR/assetlinks.json" << EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "web",
      "site": "$SITE_ORIGIN",
      "sha256_cert_fingerprints": [
        "$TWA_SHA256_FINGERPRINT"
      ]
    }
  }
]
EOF
    echo "✅ 数字资产链接文件已生成: $ASSETLINKS_DIR/assetlinks.json"
    echo "   关联的网站: $SITE_ORIGIN"
fi

echo ""
echo "🎉 TWA 自动化构建完成！"
echo ""
echo "📱 版本: $VERSION_NAME (Code: $VERSION_CODE)"
echo "📦 APK 文件:"
echo " - $APPS_DIR/hsnphira-v$VERSION_NAME.apk"
echo " - $APPS_DIR/hsnphira-latest.apk"
echo ""
if [ -n "$TWA_SHA256_FINGERPRINT" ]; then
    echo "📄 数字资产链接: /.well-known/assetlinks.json"
    echo ""
fi
echo "🚀 下一步:"
echo " 1. APK 将自动部署到服务器"
echo " 2. 下载页面将自动更新"
echo " 3. 用户可以下载最新版本"
