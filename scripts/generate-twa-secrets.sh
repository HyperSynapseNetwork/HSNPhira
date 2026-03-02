#!/bin/bash

# HSNPhira TWA 机密数据生成脚本
# 在本地运行，生成所有需要的 GitHub Secrets 值
# 避免在 SSH 终端中复制粘贴导致的问题

set -e

echo "🔑 HSNPhira TWA 机密数据生成工具"
echo "========================================="

# 检查必要的工具
if ! command -v keytool &> /dev/null; then
    echo "❌ 错误: keytool 未安装"
    echo "请安装 Java JDK:"
    echo "  Ubuntu/Debian: sudo apt install openjdk-11-jdk-headless"
    echo "  macOS: brew install openjdk@11"
    echo "  Windows: 下载并安装 OpenJDK"
    exit 1
fi

if ! command -v base64 &> /dev/null; then
    echo "❌ 错误: base64 命令未安装"
    exit 1
fi

# 输出目录
OUTPUT_DIR="./twa-secrets-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"

# 生成密码（如果未提供）
KEYSTORE_PASSWORD="hsnphira_$(openssl rand -hex 8 2>/dev/null || date +%s | sha256sum | head -c 16)"
KEY_PASSWORD="$KEYSTORE_PASSWORD"

echo ""
echo "📝 生成配置参数:"
echo "  - 密钥别名: hsnphira"
echo "  - 密钥库密码: $KEYSTORE_PASSWORD"
echo "  - 密钥密码: $KEY_PASSWORD"

# 生成密钥库
KEYSTORE_FILE="$OUTPUT_DIR/twa-release.keystore"
echo ""
echo "🛠️  生成签名密钥库..."

keytool -genkey -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "hsnphira" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=HSNPhira, OU=HyperSynapse Network, O=HyperSynapse Network, L=Guangzhou, ST=Guangdong, C=CN" \
  -storepass "$KEYSTORE_PASSWORD" \
  -keypass "$KEY_PASSWORD" \
  2>&1 | tee "$OUTPUT_DIR/keytool-generation.log"

if [ ! -f "$KEYSTORE_FILE" ]; then
    echo "❌ 密钥库生成失败"
    exit 1
fi

echo "✅ 密钥库已生成: $KEYSTORE_FILE"

# 提取 SHA256 指纹
echo ""
echo "🔍 提取 SHA256 指纹..."

SHA256_FINGERPRINT=$(keytool -list -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "hsnphira" \
  -storepass "$KEYSTORE_PASSWORD" 2>/dev/null | \
  grep "SHA256:" | \
  cut -d' ' -f3)

if [ -z "$SHA256_FINGERPRINT" ]; then
    echo "❌ 无法提取 SHA256 指纹"
    exit 1
fi

echo "✅ SHA256 指纹: $SHA256_FINGERPRINT"

# 生成 base64 编码（不带换行符）
echo ""
echo "📄 生成 base64 编码的密钥库..."

# 先读取文件内容，然后进行base64编码，并移除所有换行符
KEYSTORE_BASE64=$(cat "$KEYSTORE_FILE" | base64 | tr -d '\n')

if [ -z "$KEYSTORE_BASE64" ]; then
    echo "❌ base64 编码失败"
    exit 1
fi

echo "✅ Base64 编码完成 (长度: ${#KEYSTORE_BASE64} 字符)"

# 生成 GitHub Secrets 配置文件
echo ""
echo "📋 生成 GitHub Secrets 配置..."

cat > "$OUTPUT_DIR/github-secrets-values.txt" << EOF
# HSNPhira TWA GitHub Secrets 值
# 生成时间: $(date)
# 文件: $OUTPUT_DIR/github-secrets-values.txt

# =========================================
# 🔑 复制以下内容到 GitHub Secrets:
# =========================================

# 1. 密钥库文件 (Base64编码)
# Secret Name: TWA_KEYSTORE_BASE64
# Secret Value (复制整个值，包括所有字符):
$KEYSTORE_BASE64

# =========================================

# 2. 密钥库密码
# Secret Name: TWA_KEYSTORE_PASSWORD
# Secret Value: $KEYSTORE_PASSWORD

# =========================================

# 3. 密钥别名
# Secret Name: TWA_KEY_ALIAS
# Secret Value: hsnphira

# =========================================

# 4. 密钥密码
# Secret Name: TWA_KEY_PASSWORD
# Secret Value: $KEY_PASSWORD

# =========================================

# 5. SHA256 指纹（用于数字资产链接）
# Secret Name: TWA_SHA256_FINGERPRINT
# Secret Value: $SHA256_FINGERPRINT

# =========================================
EOF

# 生成数字资产链接文件
cat > "$OUTPUT_DIR/assetlinks.json" << EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "web",
      "site": "https://phira.htadiy.com",
      "sha256_cert_fingerprints": [
        "$SHA256_FINGERPRINT"
      ]
    }
  }
]
EOF

# 生成部署说明
cat > "$OUTPUT_DIR/README.md" << EOF
# HSNPhira TWA 机密数据

## 文件说明

1. \`twa-release.keystore\` - 签名密钥库文件
2. \`github-secrets-values.txt\` - GitHub Secrets 值
3. \`assetlinks.json\` - 数字资产链接文件
4. \`keytool-generation.log\` - 密钥生成日志

## 部署步骤

### 1. 更新数字资产链接文件
复制 \`assetlinks.json\` 到项目目录:
\`\`\`bash
cp "$OUTPUT_DIR/assetlinks.json" ./public/.well-known/assetlinks.json
\`\`\`

### 2. 配置 GitHub Secrets
访问仓库 Settings → Secrets and variables → Actions

添加以下 Secrets:

#### TWA_KEYSTORE_BASE64
**重要**: 复制整个 base64 字符串（单行，无换行符）
值:
\`\`\`
$KEYSTORE_BASE64
\`\`\`

#### TWA_KEYSTORE_PASSWORD
值: \`$KEYSTORE_PASSWORD\`

#### TWA_KEY_ALIAS
值: \`hsnphira\`

#### TWA_KEY_PASSWORD
值: \`$KEY_PASSWORD\`

#### TWA_SHA256_FINGERPRINT
值: \`$SHA256_FINGERPRINT\`

### 3. 更新构建脚本
确保 \`scripts/build-twa-auto.sh\` 正确处理 base64 字符串。

### 4. 测试构建
推送代码到仓库，检查 GitHub Actions 构建是否成功。

## 故障排除

### base64 解码失败
如果构建时出现 "base64: invalid input" 错误:
1. 确保 Secrets 中的 base64 字符串是单行
2. 没有多余的空格或换行符
3. 使用以下命令验证:
   \`\`\`bash
   echo "BASE64_STRING" | base64 -d > /dev/null && echo "OK" || echo "Invalid"
   \`\`\`

### 签名验证失败
如果出现 "Verification failed":
1. 检查所有密码是否正确
2. 确保密钥别名匹配
3. 重新生成所有机密数据

## 备份建议
1. 安全备份 \`twa-release.keystore\` 文件
2. 记录所有密码
3. 不要将密钥库提交到代码仓库

## 联系信息
如有问题，请联系项目维护者。
EOF

# 生成快速复制脚本（用于 macOS/Linux）
cat > "$OUTPUT_DIR/setup-secrets.sh" << 'EOF'
#!/bin/bash

# 快速设置 GitHub Secrets 的辅助脚本
# 需要安装 GitHub CLI: https://cli.github.com/

if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI 未安装"
    echo "请先安装: https://cli.github.com/"
    exit 1
fi

# 从文件读取值
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALUES_FILE="$SCRIPT_DIR/github-secrets-values.txt"

if [ ! -f "$VALUES_FILE" ]; then
    echo "❌ 找不到配置文件: $VALUES_FILE"
    exit 1
fi

# 提取各个值
TWA_KEYSTORE_BASE64=$(grep -A 1 "TWA_KEYSTORE_BASE64" "$VALUES_FILE" | tail -1)
TWA_KEYSTORE_PASSWORD=$(grep "TWA_KEYSTORE_PASSWORD" "$VALUES_FILE" | cut -d':' -f2 | xargs)
TWA_KEY_ALIAS=$(grep "TWA_KEY_ALIAS" "$VALUES_FILE" | cut -d':' -f2 | xargs)
TWA_KEY_PASSWORD=$(grep "TWA_KEY_PASSWORD" "$VALUES_FILE" | cut -d':' -f2 | xargs)
TWA_SHA256_FINGERPRINT=$(grep "TWA_SHA256_FINGERPRINT" "$VALUES_FILE" | cut -d':' -f2 | xargs)

echo "🔑 设置 GitHub Secrets..."
echo "仓库: $(gh repo view --json name -q '.name')"

# 设置 Secrets
gh secret set TWA_KEYSTORE_BASE64 -b "$TWA_KEYSTORE_BASE64"
gh secret set TWA_KEYSTORE_PASSWORD -b "$TWA_KEYSTORE_PASSWORD"
gh secret set TWA_KEY_ALIAS -b "$TWA_KEY_ALIAS"
gh secret set TWA_KEY_PASSWORD -b "$TWA_KEY_PASSWORD"
gh secret set TWA_SHA256_FINGERPRINT -b "$TWA_SHA256_FINGERPRINT"

echo "✅ GitHub Secrets 已设置完成"
EOF

chmod +x "$OUTPUT_DIR/setup-secrets.sh"

# 生成验证脚本
cat > "$OUTPUT_DIR/verify-base64.sh" << 'EOF'
#!/bin/bash

# 验证 base64 字符串是否有效

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALUES_FILE="$SCRIPT_DIR/github-secrets-values.txt"

if [ ! -f "$VALUES_FILE" ]; then
    echo "❌ 找不到配置文件: $VALUES_FILE"
    exit 1
fi

# 提取 base64 字符串
BASE64_STR=$(grep -A 1 "TWA_KEYSTORE_BASE64" "$VALUES_FILE" | tail -1)

echo "🔍 验证 base64 字符串..."
echo "长度: ${#BASE64_STR} 字符"

# 检查是否包含换行符
if echo "$BASE64_STR" | grep -q $'\n'; then
    echo "⚠️  警告: base64 字符串包含换行符"
    echo "清理中..."
    CLEANED_STR=$(echo "$BASE64_STR" | tr -d '\n')
    echo "清理后长度: ${#CLEANED_STR} 字符"
    BASE64_STR="$CLEANED_STR"
fi

# 验证 base64 格式
if echo "$BASE64_STR" | base64 -d > /dev/null 2>&1; then
    echo "✅ base64 字符串有效"
    
    # 测试解码
    TEMP_FILE=$(mktemp)
    echo "$BASE64_STR" | base64 -d > "$TEMP_FILE"
    
    # 检查文件类型
    FILE_TYPE=$(file "$TEMP_FILE" | cut -d':' -f2)
    echo "解码文件类型: $FILE_TYPE"
    
    # 检查是否是有效的 keystore
    if command -v keytool &> /dev/null; then
        echo "🔑 检查密钥库..."
        if keytool -list -keystore "$TEMP_FILE" -storepass "dummy" > /dev/null 2>&1; then
            echo "✅ 是有效的密钥库文件"
        else
            echo "⚠️  可能不是有效的密钥库文件"
        fi
    fi
    
    rm -f "$TEMP_FILE"
else
    echo "❌ base64 字符串无效"
    exit 1
fi

echo ""
echo "📋 验证结果:"
echo "  - Base64 字符串有效: 是"
echo "  - 长度: ${#BASE64_STR} 字符"
echo "  - 包含换行符: 否"
echo ""
echo "✅ 验证通过，可以安全地设置到 GitHub Secrets"
EOF

chmod +x "$OUTPUT_DIR/verify-base64.sh"

# 输出总结
echo ""
echo "🎉 机密数据生成完成！"
echo ""
echo "📁 输出目录: $OUTPUT_DIR"
echo ""
echo "📋 生成的文件:"
ls -la "$OUTPUT_DIR/"
echo ""
echo "🚀 下一步操作:"
echo "  1. 复制 assetlinks.json 到项目:"
echo "     cp \"$OUTPUT_DIR/assetlinks.json\" ./public/.well-known/assetlinks.json"
echo ""
echo "  2. 设置 GitHub Secrets:"
echo "     a. 查看 \"$OUTPUT_DIR/github-secrets-values.txt\""
echo "     b. 复制每个值到对应的 GitHub Secret"
echo "     c. 或者运行 \"$OUTPUT_DIR/setup-secrets.sh\" (需要 GitHub CLI)"
echo ""
echo "  3. 验证 base64 字符串:"
echo "     cd \"$OUTPUT_DIR\" && ./verify-base64.sh"
echo ""
echo "  4. 备份密钥库文件:"
echo "     🔒 安全保存: \"$OUTPUT_DIR/twa-release.keystore\""
echo ""
echo "⚠️  重要安全提示:"
echo "  - 不要将密钥库文件提交到代码仓库"
echo "  - 不要分享密码或密钥库文件"
echo "  - 安全备份所有生成的文件"
echo ""
echo "📞 如有问题，请检查日志文件: $OUTPUT_DIR/keytool-generation.log"