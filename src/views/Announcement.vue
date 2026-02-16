<template>
  <div class="container mx-auto px-4 py-24 max-w-4xl">
    <h1 class="text-4xl font-bold text-white text-center mb-12">{{ t('announcement.pageTitle') }}</h1>

    <!-- 公告区域 -->
    <div class="glass rounded-3xl p-8 mb-8">
      <h2 class="text-2xl font-bold text-white mb-6">{{ t('announcement.latestAnnouncements') }}</h2>
      
      <div class="space-y-4">
        <div
          v-for="(announcement, index) in announcements"
          :key="index"
          class="glass-dark rounded-2xl p-6"
        >
          <div class="flex items-start justify-between mb-2">
            <h3 class="text-xl font-bold text-white">{{ announcement.title }}</h3>
            <span class="text-white/40 text-sm">{{ announcement.date }}</span>
          </div>
          <p class="text-white/80">{{ announcement.content }}</p>
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
          <div class="text-white text-lg font-mono mb-3 break-all">service.htadiy.com:7865</div>
          <Button size="sm" class="w-full" @click="copyServer">
{{ t('announcement.copyAddress') }}
          </Button>
        </div>

        <div class="glass-dark rounded-2xl p-4 hover:scale-105 transition-transform">
          <div class="text-white/60 text-sm mb-2">{{ t('announcement.email') }}</div>
          <div class="text-white text-lg mb-3">nb3502022@outlook.com</div>
          <Button size="sm" class="w-full" @click="copyEmail">
{{ t('announcement.copyEmail') }}
          </Button>
        </div>

        <div class="glass-dark rounded-2xl p-4 hover:scale-105 transition-transform">
          <div class="text-white/60 text-sm mb-2">{{ t('announcement.github') }}</div>
          <a
            href="https://github.com/HyperSynapseNetwork/HSNPhira"
            target="_blank"
            class="text-primary text-lg glow-on-hover block mb-3"
          >
            HSNPhira官方仓库
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
            class="text-primary text-lg glow-on-hover block mb-3"
          >
            Firefly的Bilibili
          </a>
          <Button size="sm" class="w-full" @click="openBilibili">
{{ t('announcement.visitBilibili') }}
          </Button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { copyToClipboard } from '@/utils/message'
import Button from '@/components/common/Button.vue'
import { useI18nStore } from '@/stores/i18n'

const { t } = useI18nStore()

const announcements = ref([
  {
    title: t('announcement.phiraMpReleaseTitle'),
    content: t('announcement.phiraMpReleaseContent') + ' https://github.com/HyperSynapseNetwork/phira-mp',
    date: '2026-02-17'
  },
  {
    title: t('announcement.frontendReleaseTitle'),
    content: t('announcement.frontendReleaseContent') + ' https://github.com/HyperSynapseNetwork/HSNPhira',
    date: '2026-02-17'
  },
  {
    title: t('announcement.welcomeTitle'),
    content: t('announcement.welcomeContent'),
    date: '2025-07-01'
  },
  {
    title: t('announcement.maintenanceTitle'),
    content: t('announcement.maintenanceContent'),
    date: '2026-02-15'
  }
])


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
</script>
