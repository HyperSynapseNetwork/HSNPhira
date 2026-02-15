<template>
  <div class="container mx-auto px-4 py-24 max-w-4xl">
    <h1 class="text-4xl font-bold text-white text-center mb-12">{{ t('phiraDownload.title') }}</h1>

    <div class="glass rounded-3xl p-8 space-y-6">
      <p class="text-white/80 text-center mb-8">
        {{ t('phiraDownload.versionInfo') }}
      </p>

      <div class="space-y-4">
        <!-- Android -->
        <div class="glass-dark rounded-2xl p-6">
          <div class="flex items-center justify-between flex-wrap gap-4">
            <div class="flex-1">
              <h3 class="text-xl font-bold text-white mb-2">{{ t('phiraDownload.android') }}</h3>
              <p class="text-white/60 text-sm">{{ t('phiraDownload.forAndroid') }}</p>
            </div>
            <Button @click="download('android')">
              {{ t('phiraDownload.downloadBtn') }} APK
            </Button>
          </div>
        </div>

        <!-- Windows -->
        <div class="glass-dark rounded-2xl p-6">
          <div class="flex items-center justify-between flex-wrap gap-4">
            <div class="flex-1">
              <h3 class="text-xl font-bold text-white mb-2">{{ t('phiraDownload.windows') }}</h3>
              <p class="text-white/60 text-sm">{{ t('phiraDownload.forWindows') }}</p>
            </div>
            <Button @click="download('windows')">
              {{ t('phiraDownload.downloadBtn') }} ZIP
            </Button>
          </div>
        </div>

        <!-- Linux -->
        <div class="glass-dark rounded-2xl p-6">
          <div class="flex items-center justify-between flex-wrap gap-4">
            <div class="flex-1">
              <h3 class="text-xl font-bold text-white mb-2">{{ t('phiraDownload.linux') }}</h3>
              <p class="text-white/60 text-sm">{{ t('phiraDownload.forLinux') }}</p>
            </div>
            <Button @click="download('linux')">
              {{ t('phiraDownload.downloadBtn') }} ZIP
            </Button>
          </div>
        </div>
      </div>

      <div class="mt-8 p-4 glass rounded-xl">
        <h4 class="text-white font-bold mb-2">{{ t('phiraDownload.installInstructions') }}</h4>
        <ul class="text-white/80 text-sm space-y-2 list-disc list-inside">
          <li>{{ t('phiraDownload.androidInstall') }}</li>
          <li>{{ t('phiraDownload.windowsInstall') }}</li>
          <li>{{ t('phiraDownload.linuxInstall') }}</li>
        </ul>
      </div>

      <div class="text-center text-white/60 text-sm space-y-2">
        <p class="text-xs text-white/40">
          {{ t('phiraDownload.downloadNote') }}
        </p>
        <p>
          {{ t('phiraDownload.downloadIssue') }}
          <a href="https://github.com/TeamFlos/phira/releases" target="_blank" class="text-primary glow-on-hover">
            {{ t('phiraDownload.githubLink') }}
          </a>
          获取更多版本
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18nStore } from '@/stores/i18n'
import { showSuccess } from '@/utils/message'
import Button from '@/components/common/Button.vue'

const { t } = useI18nStore()

const downloadUrls = {
  android: 'https://hk.gh-proxy.org/https://github.com/TeamFlos/phira/releases/download/v0.6.7/Phira-v0.6.7-arm64-v8a.apk',
  windows: 'https://hk.gh-proxy.org/https://github.com/TeamFlos/phira/releases/download/v0.6.7/Phira-windows-v0.6.7.zip',
  linux: 'https://hk.gh-proxy.org/https://github.com/TeamFlos/phira/releases/download/v0.6.7/Phira-linux-v0.6.7.zip'
}

function download(platform: keyof typeof downloadUrls) {
  const url = downloadUrls[platform]
  const link = document.createElement('a')
  link.href = url
  link.download = ''
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  showSuccess('下载开始', '文件下载已开始，请查看浏览器下载列表')
}
</script>
