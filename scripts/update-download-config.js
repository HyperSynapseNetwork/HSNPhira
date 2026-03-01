#!/usr/bin/env node

/**
 * 更新下载配置文件，添加最新的 HSNPhira TWA APK 下载链接
 * 在 GitHub Actions 构建后自动运行
 */

const fs = require('fs');
const path = require('path');

// 配置文件路径
const CONFIG_DIR = path.join(__dirname, '..', 'public', 'config');
const DOWNLOAD_CONFIG_PATH = path.join(CONFIG_DIR, 'download.config.json');

// 版本信息
const GITHUB_RUN_NUMBER = process.env.GITHUB_RUN_NUMBER || '1';
const VERSION_NAME = `0.0.${GITHUB_RUN_NUMBER}`;
const VERSION_CODE = GITHUB_RUN_NUMBER;

console.log('🔄 更新下载配置文件...');
console.log(`📱 版本信息: ${VERSION_NAME} (Code: ${VERSION_CODE})`);

// 读取现有的配置文件
let config;
try {
  config = JSON.parse(fs.readFileSync(DOWNLOAD_CONFIG_PATH, 'utf8'));
  console.log('✅ 配置文件已加载');
} catch (error) {
  console.error('❌ 无法读取配置文件:', error.message);
  process.exit(1);
}

// 更新 HSNPhira 应用信息
const hsnphiraApp = {
  id: 'hsnphira-android',
  title: {
    zh: `HSNPhira Android (v${VERSION_NAME})`,
    'zh-TW': `HSNPhira Android (v${VERSION_NAME})`,
    en: `HSNPhira Android (v${VERSION_NAME})`,
    ja: `HSNPhira Android (v${VERSION_NAME})`
  },
  description: {
    zh: `HSNPhira安卓应用 v${VERSION_NAME}，通过TWA技术打包，提供原生应用体验`,
    'zh-TW': `HSNPhira安卓應用 v${VERSION_NAME}，通過TWA技術打包，提供原生應用體驗`,
    en: `HSNPhira Android app v${VERSION_NAME}, packaged with TWA technology, provides native app experience`,
    ja: `HSNPhira Androidアプリ v${VERSION_NAME}、TWA技術でパッケージ化、ネイティブアプリ体験を提供`
  },
  buttonText: {
    zh: '下载 APK',
    'zh-TW': '下載 APK',
    en: 'Download APK',
    ja: 'APKをダウンロード'
  },
  buttonLink: '/apps/hsnphira.apk'
};

// 更新或添加 HSNPhira 应用
if (!config.hsnphiraApps) {
  config.hsnphiraApps = [];
}

// 查找现有的 HSNPhira 应用
const existingIndex = config.hsnphiraApps.findIndex(app => app.id === 'hsnphira-android');
if (existingIndex >= 0) {
  config.hsnphiraApps[existingIndex] = hsnphiraApp;
  console.log('✅ 更新了现有的 HSNPhira 应用');
} else {
  config.hsnphiraApps.push(hsnphiraApp);
  console.log('✅ 添加了新的 HSNPhira 应用');
}

// 创建版本信息文件（用于跟踪构建版本）
const versionInfo = {
  twaVersionName: VERSION_NAME,
  twaVersionCode: VERSION_CODE,
  buildNumber: GITHUB_RUN_NUMBER,
  buildDate: new Date().toISOString(),
  apkFiles: [
    `/apps/hsnphira-v${VERSION_NAME}.apk`,
    '/apps/hsnphira.apk'
  ]
};

// 写入更新后的配置文件
try {
  fs.writeFileSync(DOWNLOAD_CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log('✅ 下载配置文件已更新');
  
  // 写入版本信息文件
  const versionInfoPath = path.join(CONFIG_DIR, 'twa-version.json');
  fs.writeFileSync(versionInfoPath, JSON.stringify(versionInfo, null, 2));
  console.log('✅ 版本信息文件已生成:', versionInfoPath);
  
  // 创建 APK 版本清单（用于服务器部署）
  const apkManifest = {
    latest: {
      version: VERSION_NAME,
      apk: '/apps/hsnphira.apk',
      date: new Date().toISOString()
    },
    versions: [
      {
        version: VERSION_NAME,
        apk: `/apps/hsnphira-v${VERSION_NAME}.apk`,
        date: new Date().toISOString(),
        buildNumber: GITHUB_RUN_NUMBER
      }
    ]
  };
  
  const apkManifestPath = path.join(CONFIG_DIR, 'apk-manifest.json');
  fs.writeFileSync(apkManifestPath, JSON.stringify(apkManifest, null, 2));
  console.log('✅ APK 清单文件已生成:', apkManifestPath);
  
} catch (error) {
  console.error('❌ 无法写入配置文件:', error.message);
  process.exit(1);
}

console.log('🎉 下载配置更新完成！');
console.log('');
console.log('📱 HSNPhira TWA 版本:', VERSION_NAME);
console.log('📦 下载链接: /apps/hsnphira.apk');
console.log('📋 版本化副本: /apps/hsnphira-v' + VERSION_NAME + '.apk');