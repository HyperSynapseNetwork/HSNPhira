#!/bin/bash

# HSNPhira TWA 一键安装和配置脚本
# 支持自动检测文件、生成所需文件、共享密钥库等签名文件

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$PROJECT_ROOT/scripts"
DIST_DIR="$PROJECT_ROOT/dist"
TWA_DIR="$PROJECT_ROOT/twa"
CONFIG_DIR="$PROJECT_ROOT/public/config"
PUBLIC_DIR="$PROJECT_ROOT/public"
WELL_KNOWN_DIR="$PUBLIC_DIR/.well-known"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    HSNPhira TWA 一键安装配置工具${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# 显示帮助信息
show_help() {
    print_header
    echo
    echo "用法: $0 [选项]"
    echo
    echo "选项:"
    echo "  -h, --help                显示此帮助信息"
    echo "  -a, --auto                自动模式（非交互式）"
    echo "  -k, --keystore <文件>     指定密钥库文件路径"
    echo "  -p, --password <密码>     指定密钥库密码"
    echo "  -A, --alias <别名>        指定密钥别名"
    echo "  -f, --fingerprint <指纹>  指定 SHA256 证书指纹"
    echo "  -d, --domain <域名>       指定数字资产链接域名（默认: https://phira.htadiy.com）"
    echo "  -b, --build               构建 TWA APK"
    echo "  -s, --skip-deps           跳过依赖检查"
    echo
    echo "示例:"
    echo "  $0                        # 交互式配置"
    echo "  $0 --auto                 # 自动模式（使用默认值）"
    echo "  $0 --keystore ./my.keystore --password pass123 --alias key1 --build"
    echo
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."

    local missing_deps=0

    # 检查 Java
    if command -v java &> /dev/null; then
        java_version=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2)
        log_success "Java $java_version 已安装"
    else
        log_error "Java 未安装，请安装 Java 11+"
        missing_deps=1
    fi

    # 检查 Node.js
    if command -v node &> /dev/null; then
        node_version=$(node --version)
        log_success "Node.js $node_version 已安装"
    else
        log_error "Node.js 未安装，请安装 Node.js"
        missing_deps=1
    fi

    # 检查 npm
    if command -v npm &> /dev/null; then
        npm_version=$(npm --version)
        log_success "npm $npm_version 已安装"
    else
        log_error "npm 未安装"
        missing_deps=1
    fi

    # 检查 bubblewrap
    if npm list -g @bubblewrap/cli &> /dev/null; then
        bubblewrap_version=$(bubblewrap --version 2>/dev/null || echo "未知版本")
        log_success "bubblewrap $bubblewrap_version 已安装"
    else
        log_warning "bubblewrap 未安装，将尝试安装..."
        if [ "$AUTO_MODE" = true ]; then
            log_info "自动安装 bubblewrap..."
            npm install -g @bubblewrap/cli
            log_success "bubblewrap 安装完成"
        else
            read -p "是否安装 bubblewrap？ (y/N): " install_bubblewrap
            if [[ "$install_bubblewrap" =~ ^[Yy]$ ]]; then
                npm install -g @bubblewrap/cli
                log_success "bubblewrap 安装完成"
            else
                log_error "需要 bubblewrap 来构建 TWA"
                missing_deps=1
            fi
        fi
    fi

    # 检查 keytool（用于处理密钥库）
    if command -v keytool &> /dev/null; then
        log_success "keytool 已安装"
    else
        log_warning "keytool 未安装（通常随 JDK 一起安装）"
    fi

    return $missing_deps
}

# 检查前端构建
check_frontend_build() {
    log_info "检查前端构建..."

    if [ ! -d "$DIST_DIR" ] || [ ! -f "$DIST_DIR/manifest.json" ]; then
        log_warning "前端应用未构建或 manifest.json 不存在"
        
        if [ "$AUTO_MODE" = true ]; then
            log_info "自动构建前端应用..."
            cd "$PROJECT_ROOT"
            npm run build
            log_success "前端构建完成"
        else
            read -p "是否构建前端应用？ (Y/n): " build_frontend
            if [[ "$build_frontend" =~ ^[Yy]$ ]] || [[ -z "$build_frontend" ]]; then
                cd "$PROJECT_ROOT"
                npm run build
                log_success "前端构建完成"
            else
                log_error "需要构建前端应用才能继续"
                return 1
            fi
        fi
    else
        log_success "前端构建已存在"
    fi

    return 0
}

# 创建必要目录
create_directories() {
    log_info "创建必要目录..."

    mkdir -p "$TWA_DIR"
    mkdir -p "$WELL_KNOWN_DIR"
    mkdir -p "$CONFIG_DIR"
    
    log_success "目录结构已就绪"
}

# 检查并更新 TWA manifest
check_twa_manifest() {
    log_info "检查 TWA manifest 配置..."

    local manifest_file="$TWA_DIR/twa-manifest.json"
    local dist_manifest="$DIST_DIR/manifest.json"
    
    # 如果 twa-manifest.json 不存在，从 dist 目录复制或创建
    if [ ! -f "$manifest_file" ]; then
        log_warning "twa-manifest.json 不存在"
        
        if [ -f "$dist_manifest" ]; then
            log_info "从构建产物复制 manifest.json 作为基础..."
            cp "$dist_manifest" "$manifest_file"
            
            # 更新必要的 TWA 特定字段
            if command -v jq &> /dev/null; then
                jq '. + {
                    "packageId": "com.hypersn.phira",
                    "versionCode": "1",
                    "versionName": "1.0.0",
                    "name": "HSNPhira",
                    "launcherName": "HSNPhira",
                    "startUrl": "/",
                    "backgroundColor": "#1a1a1a",
                    "themeColor": "#1a1a1a",
                    "enableNotifications": true,
                    "webManifestUrl": "https://phira.htadiy.com/manifest.json",
                    "orientation": "portrait"
                }' "$manifest_file" > "${manifest_file}.tmp" && mv "${manifest_file}.tmp" "$manifest_file"
                log_success "TWA manifest 已创建并配置"
            else
                log_warning "jq 命令未安装，使用基础 manifest"
            fi
        else
            # 创建默认的 TWA manifest
            log_info "创建默认 TWA manifest..."
            cat > "$manifest_file" << EOF
{
  "packageId": "com.hypersn.phira",
  "versionCode": "1",
  "versionName": "1.0.0",
  "name": "HSNPhira",
  "launcherName": "HSNPhira",
  "startUrl": "/",
  "backgroundColor": "#1a1a1a",
  "themeColor": "#1a1a1a",
  "navigationColor": "#1a1a1a",
  "navigationColorDark": "#000000",
  "navigationDividerColor": "#1a1a1a",
  "navigationDividerColorDark": "#000000",
  "splashScreenFadeOutDuration": 300,
  "enableNotifications": true,
  "webManifestUrl": "https://phira.htadiy.com/manifest.json",
  "fallbackType": "customtabs",
  "features": {
    "locationDelegation": {
      "enabled": true
    },
    "playBilling": {
      "enabled": false
    }
  },
  "alphaDependencies": {
    "enabled": false
  },
  "enableSiteSettingsShortcut": true,
  "isChromeOSOnly": false,
  "orientation": "portrait",
  "fingerprints": [],
  "additionalTrustedOrigins": [],
  "retainedBundles": []
}
EOF
            log_success "默认 TWA manifest 已创建"
        fi
    else
        log_success "TWA manifest 已存在"
    fi

    # 显示当前配置
    log_info "当前 TWA 配置:"
    echo "  - 包名: com.hypersn.phira"
    echo "  - 应用名: HSNPhira"
    echo "  - 启动URL: /"
    echo "  - 主题颜色: #1a1a1a"
    
    return 0
}

# 处理密钥库
handle_keystore() {
    log_info "处理密钥库配置..."

    local keystore_file="$TWA_DIR/production.keystore"
    
    # 如果提供了密钥库文件
    if [ -n "$KEYSTORE_PATH" ] && [ -f "$KEYSTORE_PATH" ]; then
        log_info "使用指定的密钥库文件: $KEYSTORE_PATH"
        cp "$KEYSTORE_PATH" "$keystore_file"
        log_success "密钥库已复制到 $keystore_file"
        
        # 验证密钥库
        if command -v keytool &> /dev/null; then
            log_info "验证密钥库..."
            if keytool -list -keystore "$keystore_file" -storepass "$KEYSTORE_PASSWORD" 2>/dev/null; then
                log_success "密钥库验证成功"
                
                # 显示密钥库信息
                log_info "密钥库信息:"
                keytool -list -v -keystore "$keystore_file" -storepass "$KEYSTORE_PASSWORD" 2>/dev/null | grep -E "(别名|创建日期|证书指纹)" || true
            else
                log_warning "密钥库密码验证失败"
                if [ "$AUTO_MODE" != true ]; then
                    read -p "请输入正确的密钥库密码: " -s correct_password
                    echo
                    KEYSTORE_PASSWORD="$correct_password"
                fi
            fi
        fi
    # 检查是否有现有的密钥库
    elif [ -f "$keystore_file" ]; then
        log_success "发现现有的密钥库文件"
        
        if [ "$AUTO_MODE" != true ] && [ -z "$KEYSTORE_PASSWORD" ]; then
            read -p "请输入密钥库密码 (留空则跳过验证): " -s KEYSTORE_PASSWORD
            echo
        fi
        
        if [ -n "$KEYSTORE_PASSWORD" ] && command -v keytool &> /dev/null; then
            if keytool -list -keystore "$keystore_file" -storepass "$KEYSTORE_PASSWORD" 2>/dev/null; then
                log_success "密钥库验证成功"
            else
                log_warning "密钥库密码验证失败"
            fi
        fi
    else
        log_warning "未找到密钥库文件"
        
        if [ "$AUTO_MODE" = true ]; then
            log_info "自动模式：跳过密钥库创建"
            return 0
        fi
        
        read -p "是否创建新的调试密钥库？ (y/N): " create_keystore
        if [[ "$create_keystore" =~ ^[Yy]$ ]]; then
            log_info "创建调试密钥库..."
            
            # 设置默认值
            local keystore_alias="${KEY_ALIAS:-androiddebugkey}"
            local keystore_password="${KEYSTORE_PASSWORD:-android}"
            local key_password="${KEY_PASSWORD:-android}"
            
            if [ "$AUTO_MODE" != true ]; then
                read -p "密钥库别名 [$keystore_alias]: " input_alias
                [ -n "$input_alias" ] && keystore_alias="$input_alias"
                
                read -p "密钥库密码 [$keystore_password]: " -s input_storepass
                echo
                [ -n "$input_storepass" ] && keystore_password="$input_storepass"
                
                read -p "密钥密码 [$key_password]: " -s input_keypass
                echo
                [ -n "$input_keypass" ] && key_password="$input_keypass"
            fi
            
            # 创建密钥库
            keytool -genkeypair \
                -v \
                -keystore "$keystore_file" \
                -alias "$keystore_alias" \
                -keyalg RSA \
                -keysize 2048 \
                -validity 10000 \
                -storepass "$keystore_password" \
                -keypass "$key_password" \
                -dname "CN=Android Debug, O=Android, C=US"
            
            if [ $? -eq 0 ]; then
                log_success "调试密钥库创建成功"
                KEYSTORE_PASSWORD="$keystore_password"
                KEY_ALIAS="$keystore_alias"
                KEY_PASSWORD="$key_password"
                
                # 显示指纹信息
                log_info "证书指纹 (SHA256):"
                local fingerprint=$(keytool -list -v -keystore "$keystore_file" -storepass "$keystore_password" -alias "$keystore_alias" 2>/dev/null | grep "SHA256:" | cut -d' ' -f3)
                if [ -n "$fingerprint" ]; then
                    echo "  $fingerprint"
                    SHA256_FINGERPRINT="$fingerprint"
                fi
            else
                log_error "密钥库创建失败"
                return 1
            fi
        else
            log_info "跳过密钥库创建，后续构建将使用默认调试密钥"
        fi
    fi
    
    return 0
}

# 配置数字资产链接
configure_asset_links() {
    log_info "配置数字资产链接..."

    local assetlinks_file="$WELL_KNOWN_DIR/assetlinks.json"
    
    # 获取域名
    local domain="${DOMAIN:-https://phira.htadiy.com}"
    
    # 获取指纹（如果可用）
    local fingerprint="$SHA256_FINGERPRINT"
    if [ -z "$fingerprint" ] && [ -n "$SHA256_FINGERPRINT_ARG" ]; then
        fingerprint="$SHA256_FINGERPRINT_ARG"
    fi
    
    if [ -z "$fingerprint" ] && [ -f "$TWA_DIR/production.keystore" ] && [ -n "$KEYSTORE_PASSWORD" ] && [ -n "$KEY_ALIAS" ]; then
        log_info "从密钥库提取 SHA256 指纹..."
        fingerprint=$(keytool -list -v -keystore "$TWA_DIR/production.keystore" -storepass "$KEYSTORE_PASSWORD" -alias "$KEY_ALIAS" 2>/dev/null | grep "SHA256:" | cut -d' ' -f3)
    fi
    
    # 创建/更新数字资产链接文件
    if [ -n "$fingerprint" ]; then
        log_info "使用 SHA256 指纹: $fingerprint"
        log_info "关联域名: $domain"
        
        cat > "$assetlinks_file" << EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "web",
      "site": "$domain",
      "sha256_cert_fingerprints": [
        "$fingerprint"
      ]
    }
  }
]
EOF
        log_success "数字资产链接文件已创建: $assetlinks_file"
        log_info "请确保该文件可通过 $domain/.well-known/assetlinks.json 访问"
    else
        log_warning "未提供 SHA256 指纹，创建基础数字资产链接文件"
        
        cat > "$assetlinks_file" << EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "web",
      "site": "$domain"
    }
  }
]
EOF
        log_success "基础数字资产链接文件已创建（不含指纹）"
        log_warning "注意：需要添加 SHA256 指纹才能通过 Android 验证"
    fi
    
    return 0
}

# 更新下载配置文件
update_download_config() {
    log_info "更新下载配置文件..."

    local download_config="$CONFIG_DIR/download.config.json"
    
    # 读取版本信息
    local version_name="1.0.0"
    if [ -f "$TWA_DIR/twa-manifest.json" ]; then
        if command -v jq &> /dev/null; then
            version_name=$(jq -r '.versionName // "1.0.0"' "$TWA_DIR/twa-manifest.json")
        fi
    fi
    
    # 检查现有配置
    if [ -f "$download_config" ]; then
        log_success "下载配置文件已存在"
        
        if command -v jq &> /dev/null; then
            # 检查是否已包含 HSNPhira 应用
            local has_hsnphira=$(jq '.hsnphiraApps // [] | map(select(.id == "hsnphira-android")) | length' "$download_config")
            
            if [ "$has_hsnphira" -eq 0 ]; then
                log_info "添加 HSNPhira 应用到下载配置"
                
                # 读取现有配置，添加 HSNPhira 应用
                jq '.hsnphiraApps = (.hsnphiraApps // []) + [{
                    "id": "hsnphira-android",
                    "title": {
                        "zh": "HSNPhira Android (v'"$version_name"')",
                        "zh-TW": "HSNPhira Android (v'"$version_name"')",
                        "en": "HSNPhira Android (v'"$version_name"')",
                        "ja": "HSNPhira Android (v'"$version_name"')"
                    },
                    "description": {
                        "zh": "HSNPhira安卓应用 v'"$version_name"'，通过TWA技术打包，提供原生应用体验",
                        "zh-TW": "HSNPhira安卓應用 v'"$version_name"'，通過TWA技術打包，提供原生應用體驗",
                        "en": "HSNPhira Android app v'"$version_name"', packaged with TWA technology, provides native app experience",
                        "ja": "HSNPhira Androidアプリ v'"$version_name"'、TWA技術でパッケージ化、ネイティブアプリ体験を提供"
                    },
                    "buttonText": {
                        "zh": "下载 APK",
                        "zh-TW": "下載 APK",
                        "en": "Download APK",
                        "ja": "APKをダウンロード"
                    },
                    "buttonLink": "/apps/hsnphira.apk"
                }]' "$download_config" > "${download_config}.tmp" && mv "${download_config}.tmp" "$download_config"
                
                log_success "HSNPhira 应用已添加到下载配置"
            else
                log_info "HSNPhira 应用已存在于下载配置中"
            fi
        else
            log_warning "jq 未安装，跳过下载配置更新"
        fi
    else
        log_warning "下载配置文件不存在，创建基础配置"
        
        cat > "$download_config" << EOF
{
  "hsnphiraApps": [
    {
      "id": "hsnphira-android",
      "title": {
        "zh": "HSNPhira Android (v$version_name)",
        "zh-TW": "HSNPhira Android (v$version_name)",
        "en": "HSNPhira Android (v$version_name)",
        "ja": "HSNPhira Android (v$version_name)"
      },
      "description": {
        "zh": "HSNPhira安卓应用 v$version_name，通过TWA技术打包，提供原生应用体验",
        "zh-TW": "HSNPhira安卓應用 v$version_name，通過TWA技術打包，提供原生應用體驗",
        "en": "HSNPhira Android app v$version_name, packaged with TWA technology, provides native app experience",
        "ja": "HSNPhira Androidアプリ v$version_name、TWA技術でパッケージ化、ネイティブアプリ体験を提供"
      },
      "buttonText": {
        "zh": "下载 APK",
        "zh-TW": "下載 APK",
        "en": "Download APK",
        "ja": "APKをダウンロード"
      },
      "buttonLink": "/apps/hsnphira.apk"
    }
  ]
}
EOF
        log_success "下载配置文件已创建"
    fi
    
    return 0
}

# 构建 TWA APK
build_twa_apk() {
    log_info "开始构建 TWA APK..."
    
    cd "$TWA_DIR"
    
    # 检查是否已初始化 bubblewrap 项目
    if [ ! -f "twa-manifest.json" ]; then
        log_error "twa-manifest.json 不存在，请先运行配置步骤"
        return 1
    fi
    
    # 设置环境变量
    if [ -n "$KEYSTORE_PASSWORD" ]; then
        export BUBBLEWRAP_KEYSTORE_PASSWORD="$KEYSTORE_PASSWORD"
    fi
    
    if [ -n "$KEY_PASSWORD" ]; then
        export BUBBLEWRAP_KEY_PASSWORD="$KEY_PASSWORD"
    fi
    
    export BUBBLEWRAP_YES=1
    export BUBBLEWRAP_NON_INTERACTIVE=1
    
    log_info "初始化/更新 bubblewrap 项目..."
    bubblewrap update
    
    log_info "构建 APK..."
    if bubblewrap build --skipPwaValidation; then
        log_success "APK 构建成功！"
        
        # 检查生成的 APK
        if [ -f "app-release-signed.apk" ]; then
            local apk_size=$(du -h "app-release-signed.apk" | cut -f1)
            log_info "APK 文件: $(pwd)/app-release-signed.apk ($apk_size)"
            
            # 复制到 dist/apps 目录
            mkdir -p "$DIST_DIR/apps"
            local version_name=$(jq -r '.versionName // "1.0.0"' twa-manifest.json 2>/dev/null || echo "1.0.0")
            local apk_filename="hsnphira-v$version_name.apk"
            
            cp "app-release-signed.apk" "$DIST_DIR/apps/$apk_filename"
            cp "app-release-signed.apk" "$DIST_DIR/apps/hsnphira-latest.apk"
            
            log_success "APK 已复制到:"
            log_info "  - $DIST_DIR/apps/$apk_filename"
            log_info "  - $DIST_DIR/apps/hsnphira-latest.apk"
            
            # 构建 App Bundle（可选）
            log_info "构建 App Bundle..."
            if bubblewrap build --bundle --skipPwaValidation 2>/dev/null; then
                log_success "App Bundle 构建成功"
            else
                log_warning "App Bundle 构建失败或跳过"
            fi
        else
            log_error "未找到生成的 APK 文件"
            return 1
        fi
    else
        log_error "APK 构建失败"
        return 1
    fi
    
    return 0
}

# 显示配置摘要
show_summary() {
    print_header
    echo
    log_info "配置摘要:"
    echo
    echo "📁 目录结构:"
    echo "  - 项目根目录: $PROJECT_ROOT"
    echo "  - TWA 配置目录: $TWA_DIR"
    echo "  - 构建输出目录: $DIST_DIR"
    echo "  - 配置文件目录: $CONFIG_DIR"
    echo
    
    echo "🔧 配置状态:"
    
    # 检查关键文件
    local check_files=(
        "$TWA_DIR/twa-manifest.json:TWA Manifest"
        "$WELL_KNOWN_DIR/assetlinks.json:数字资产链接"
        "$CONFIG_DIR/download.config.json:下载配置"
    )
    
    for file_check in "${check_files[@]}"; do
        local file_path="${file_check%:*}"
        local file_name="${file_check#*:}"
        
        if [ -f "$file_path" ]; then
            echo "  ✅ $file_name: 已配置"
        else
            echo "  ❌ $file_name: 缺失"
        fi
    done
    
    # 检查密钥库
    if [ -f "$TWA_DIR/production.keystore" ]; then
        echo "  ✅ 密钥库: 已配置"
        if command -v keytool &> /dev/null && [ -n "$KEYSTORE_PASSWORD" ]; then
            local alias_info=""
            if [ -n "$KEY_ALIAS" ]; then
                alias_info=" (别名: $KEY_ALIAS)"
            fi
            echo "     类型: 生产密钥库$alias_info"
        fi
    else
        echo "  ⚠️  密钥库: 未配置（将使用调试密钥）"
    fi
    
    echo
    echo "🚀 后续步骤:"
    echo "  1. 确保数字资产链接文件可通过网站访问"
    echo "  2. 运行构建脚本: $0 --build"
    echo "  3. 部署 APK 文件到服务器"
    echo
    echo "📋 常用命令:"
    echo "  # 仅配置不构建"
    echo "  $0"
    echo
    echo "  # 自动配置并构建"
    echo "  $0 --auto --build"
    echo
    echo "  # 使用现有密钥库"
    echo "  $0 --keystore path/to/keystore --password yourpass --alias key1 --build"
    echo
}

# 主函数
main() {
    # 解析命令行参数
    AUTO_MODE=false
    SHOULD_BUILD=false
    SKIP_DEPS=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -a|--auto)
                AUTO_MODE=true
                shift
                ;;
            -k|--keystore)
                KEYSTORE_PATH="$2"
                shift 2
                ;;
            -p|--password)
                KEYSTORE_PASSWORD="$2"
                shift 2
                ;;
            -A|--alias)
                KEY_ALIAS="$2"
                shift 2
                ;;
            -f|--fingerprint)
                SHA256_FINGERPRINT_ARG="$2"
                shift 2
                ;;
            -d|--domain)
                DOMAIN="$2"
                shift 2
                ;;
            -b|--build)
                SHOULD_BUILD=true
                shift
                ;;
            -s|--skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    print_header
    
    # 检查依赖
    if [ "$SKIP_DEPS" != true ]; then
        check_dependencies
        if [ $? -ne 0 ]; then
            log_error "依赖检查失败，请安装缺少的依赖"
            exit 1
        fi
    fi
    
    # 检查前端构建
    check_frontend_build
    if [ $? -ne 0 ]; then
        exit 1
    fi
    
    # 创建目录
    create_directories
    
    # 检查并更新 TWA manifest
    check_twa_manifest
    
    # 处理密钥库
    handle_keystore
    
    # 配置数字资产链接
    configure_asset_links
    
    # 更新下载配置
    update_download_config
    
    # 显示摘要
    show_summary
    
    # 构建 APK（如果需要）
    if [ "$SHOULD_BUILD" = true ]; then
        log_info "开始构建 TWA APK..."
        build_twa_apk
        if [ $? -eq 0 ]; then
            log_success "🎉 TWA 构建完成！"
            echo
            echo "📦 构建产物:"
            echo "  - APK 文件: $DIST_DIR/apps/"
            echo "  - 数字资产链接: $WELL_KNOWN_DIR/assetlinks.json"
            echo
            echo "🚀 部署说明:"
            echo "  1. 将 $WELL_KNOWN_DIR/assetlinks.json 部署到网站根目录"
            echo "  2. 将 $DIST_DIR/apps/ 目录下的 APK 文件部署到服务器"
            echo "  3. 确保下载页面配置正确"
        else
            log_error "TWA 构建失败"
            exit 1
        fi
    else
        log_info "配置完成！运行 $0 --build 开始构建 TWA APK"
    fi
}

# 运行主函数
main "$@"