<template>
  <div class="container mx-auto px-4 py-24 max-w-4xl">
    <h1 class="text-4xl font-bold text-white text-center mb-12">{{ t('announcement.pageTitle') }}</h1>

    <!-- 公告区域 -->
    <div class="glass rounded-3xl p-8 mb-8">
      <h2 class="text-2xl font-bold text-white mb-6">{{ t('announcement.latestAnnouncements') }}</h2>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="text-center py-8">
        <div class="inline-flex items-center">
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-white/80">{{ t('common.loading') }}</span>
        </div>
      </div>

      <!-- 无公告状态 -->
      <div v-else-if="announcements.length === 0" class="text-center py-8">
        <div class="glass-dark rounded-2xl p-8 inline-block">
          <svg class="w-16 h-16 mx-auto mb-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="text-xl font-bold text-white mb-2">{{ t('announcement.noAnnouncements') }}</h3>
          <p class="text-white/60">{{ t('announcement.noAnnouncementsDesc') }}</p>
        </div>
      </div>

      <!-- 公告列表 -->
      <div v-else class="space-y-4">
        <div
          v-for="(announcement, index) in announcements"
          :key="index"
          class="glass-dark rounded-2xl p-6"
        >
          <div class="flex items-start justify-between mb-2">
            <h3 class="text-xl font-bold text-white">{{ announcement.title }}</h3>
            <span class="text-white/40 text-sm">{{ announcement.date }}</span>
          </div>
          <p class="text-white/80 break-all overflow-wrap-anywhere">{{ announcement.content }}</p>
        </div>
      </div>
    </div>

    <!-- 联系方式 -->
    <div class="glass rounded-3xl p-8 mb-8">
      <h2 class="text-2xl font-bold text-white mb-6">{{ t('announcement.contactUs') }}</h2>
      
      <div class="grid md:grid-cols-2 gap-4">
        <div class="glass-dark rounded-2xl p-4 hover:scale-105 transition-transform">
          <div class="text-white/60 text-sm mb-2">{{ t('announcement.qqGroup') }}</div>
          <div class="text-white text-lg font-mono mb-3">1049578201</div>
          <Button size="sm" class="w-full" @click="copyQQ">
{{ t('announcement.copyGroupNumber') }}
          </Button>
        </div>

        <div class="glass-dark rounded-2xl p-4 hover:scale-105 transition-transform">
          <div class="text-white/60 text-sm mb-2">{{ t('announcement.serverAddress') }}</div>
          <div class="text-white text-lg font-mono mb-3 break-all overflow-wrap-anywhere">service.htadiy.com:7865</div>
          <Button size="sm" class="w-full" @click="copyServer">
{{ t('announcement.copyAddress') }}
          </Button>
        </div>

        <div class="glass-dark rounded-2xl p-4 hover:scale-105 transition-transform">
          <div class="text-white/60 text-sm mb-2">{{ t('announcement.email') }}</div>
          <div class="text-white text-lg mb-3 break-all overflow-wrap-anywhere">nb3502022@outlook.com</div>
          <Button size="sm" class="w-full" @click="copyEmail">
{{ t('announcement.copyEmail') }}
          </Button>
        </div>

        <div class="glass-dark rounded-2xl p-4 hover:scale-105 transition-transform">
          <div class="text-white/60 text-sm mb-2">{{ t('announcement.github') }}</div>
          <a
            href="https://github.com/HyperSynapseNetwork/HSNPhira"
            target="_blank"
            class="text-primary text-lg glow-on-hover block mb-3 break-all md:break-normal overflow-wrap-anywhere"
          >
            {{ t('announcement.githubRepo') }}
          </a>
          <Button size="sm" class="w-full" @click="openGitHub">
{{ t('announcement.visitGitHub') }}
          </Button>
        </div>

        <div class="glass-dark rounded-2xl p-4 hover:scale-105 transition-transform">
          <div class="text-white/60 text-sm mb-2">{{ t('announcement.bilibili') }}</div>
          <a
            href="https://space.bilibili.com/625719258"
            target="_blank"
            class="text-primary text-lg glow-on-hover block mb-3 break-all md:break-normal overflow-wrap-anywhere"
          >
            {{ t('announcement.bilibiliChannel') }}
          </a>
          <Button size="sm" class="w-full" @click="openBilibili">
{{ t('announcement.visitBilibili') }}
          </Button>
        </div>
      </div>
    </div>

    <!-- 支持我们 -->
    <div class="glass rounded-3xl p-8 mb-8">
      <h2 class="text-2xl font-bold text-white mb-6">{{ t('announcement.supportUs') }}</h2>
      
      <div class="grid md:grid-cols-2 gap-4">
        <div class="glass-dark rounded-2xl p-4 hover:scale-105 transition-transform">
          <div class="text-white/60 text-sm mb-2">{{ t('announcement.afdianPlatform') }}</div>
          <a
            href="https://afdian.com/a/HSNetwork"
            target="_blank"
            class="text-primary text-lg glow-on-hover block mb-3 break-all md:break-normal overflow-wrap-anywhere"
          >
            {{ t('announcement.afdianLink') }}
          </a>
          <Button size="sm" class="w-full" @click="openAfdian">
            {{ t('announcement.visitAfdian') }}
          </Button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { copyToClipboard } from '@/utils/message'
import Button from '@/components/common/Button.vue'
import { useI18nStore } from '@/stores/i18n'
import { loadAnnouncementConfig, getAnnouncementConfig } from '@/utils/config'

const { t, currentLanguage } = useI18nStore()

const isLoading = ref(false)
const announcementConfig = ref<any>(null)

const announcements = computed(() => {
  if (!announcementConfig.value || !announcementConfig.value.announcements) return []
  
  return announcementConfig.value.announcements.map((announcement: any) => ({
    title: announcement.title[currentLanguage] || announcement.title['zh'] || '',
    content: announcement.content[currentLanguage] || announcement.content['zh'] || '',
    date: announcement.time
  })).reverse() // 倒序显示，最新的在前面
})

async function loadAnnouncements() {
  try {
    isLoading.value = true
    await loadAnnouncementConfig()
    announcementConfig.value = getAnnouncementConfig()
  } catch (error) {
    console.error('Failed to load announcement config:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadAnnouncements()
})

// 监听语言变化
watch(() => currentLanguage, () => {
  if (announcementConfig.value) {
    // 强制重新计算
    announcementConfig.value = { ...announcementConfig.value }
  }
})


function copyQQ() {
  copyToClipboard('1049578201', 'QQ群号已复制')
}

function copyServer() {
  copyToClipboard('service.htadiy.com:7865', '服务器地址已复制')
}

function copyEmail() {
  copyToClipboard('nb3502022@outlook.com', '邮箱已复制')
}

function openGitHub() {
  window.open('https://github.com/HyperSynapseNetwork/HSNPhira', '_blank')
}

function openBilibili() {
  window.open('https://space.bilibili.com/625719258', '_blank')
}

function openAfdian() {
  window.open('https://afdian.com/a/HSNetwork', '_blank')
}
</script>
