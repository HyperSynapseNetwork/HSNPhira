#!/bin/bash

# HSNPhira TWA (Trusted Web Activity) 构建脚本
# 用于将 HSNPhira Web 应用打包为 Android APK

set -e

echo "🚀 开始构建 HSNPhira TWA Android 应用"

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
if ! npm list -g @bubblewrap/cli &> /dev/null; then
    echo "📦 安装 bubblewrap CLI..."
    npm install -g @bubblewrap/cli
fi

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$PROJECT_ROOT/dist"
TWA_DIR="$PROJECT_ROOT/twa"
ASSETLINKS_FILE="$TWA_DIR/assetlinks.json"
MANIFEST_FILE="$DIST_DIR/manifest.json"

# 确保 dist 目录存在（先构建前端）
if [ ! -d "$DIST_DIR" ]; then
    echo "📦 构建前端应用..."
    npm run build
fi

if [ ! -f "$MANIFEST_FILE" ]; then
    echo "❌ 未找到 manifest.json，请确保前端构建成功"
    exit 1
fi

# 创建 TWA 目录
mkdir -p "$TWA_DIR"

# 生成 assetlinks.json（需要替换为您自己的数字资产链接）
# 参考：https://developers.google.com/digital-asset-links/v1/getting-started
cat > "$ASSETLINKS_FILE" << EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "web",
      "site": "https://phira.htadiy.com"
    }
  }
]
EOF

echo "✅ 生成 assetlinks.json"

# 初始化 bubblewrap 项目（如果尚未初始化）
if [ ! -f "$TWA_DIR/twa-manifest.json" ]; then
    echo "🛠️  初始化 bubblewrap 项目..."
    cd "$TWA_DIR"
    bubblewrap init --manifest="$MANIFEST_FILE" --directory="$TWA_DIR"
else
    echo "📁 使用现有的 bubblewrap 项目"
    cd "$TWA_DIR"
fi

# 更新 manifest（可选）
echo "🔄 更新 TWA manifest..."
bubblewrap update

# 构建 APK
echo "🔨 构建 APK..."
bubblewrap build

# 构建 app bundle（可选）
echo "🔨 构建 App Bundle..."
bubblewrap build --bundle

echo "🎉 TWA 构建完成！"
echo "📦 APK 文件: $TWA_DIR/app-release-signed.apk"
echo "📦 App Bundle: $TWA_DIR/app-release-bundle.aab"
echo ""
echo "📱 安装 APK 到设备:"
echo "   adb install $TWA_DIR/app-release-signed.apk"
echo ""
echo "📄 数字资产链接需要部署到 https://phira.htadiy.com/.well-known/assetlinks.json"
echo "   请根据您的签名密钥更新 assetlinks.json 中的 SHA256 指纹。"
echo "   参考文档: https://developers.google.com/digital-asset-links/v1/getting-started"