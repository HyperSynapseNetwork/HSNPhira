<template>
  <div class="container mx-auto px-4 py-24 max-w-4xl">
    <h1 class="text-4xl font-bold text-white text-center mb-12">{{ t('phiraDownload.title') }}</h1>

    <div class="glass rounded-3xl p-8 space-y-6">
      <p class="text-white/80 text-center mb-8">
        {{ t('phiraDownload.versionInfo', { version: latestVersion }) }}
      </p>

      <div class="space-y-4">
        <!-- 动态生成下载卡片 -->
        <div
          v-for="card in downloadCards"
          :key="card.id"
          class="glass-dark rounded-2xl p-6"
        >
          <div class="flex items-center justify-between flex-wrap gap-4">
            <div class="flex-1">
              <h3 class="text-xl font-bold text-white mb-2">{{ card.title }}</h3>
              <p class="text-white/60 text-sm">{{ card.description }}</p>
            </div>
            <Button @click="download(card.id, card.buttonLink)">
              {{ card.buttonText }}
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
import { computed } from 'vue'
import { useI18nStore } from '@/stores/i18n'
import { showSuccess } from '@/utils/message'
import { getDownloadConfig, getLocalizedText } from '@/utils/config'
import Button from '@/components/common/Button.vue'

const { t } = useI18nStore()

// 从配置加载下载信息
const downloadConfig = computed(() => getDownloadConfig())
const latestVersion = computed(() => downloadConfig.value.latestVersion)

// 处理多语言文本的下载卡片
const downloadCards = computed(() => {
  const config = downloadConfig.value
  return config.downloadCards.map(card => ({
    id: card.id,
    title: getLocalizedText(card.title),
    description: getLocalizedText(card.description),
    buttonText: getLocalizedText(card.buttonText),
    buttonLink: card.buttonLink
  }))
})

function download(_platform: string, url: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = ''
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  showSuccess('下载开始', '文件下载已开始，请查看浏览器下载列表')
}
</script>
