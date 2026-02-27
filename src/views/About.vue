<template>
  <div class="page-container">
    <!-- 上部分：Logo -->
    <div class="logo-section mb-12">
      <div class="container mx-auto px-4">
        <div class="flex justify-center">
          <picture>
            <source media="(min-width: 768px)" srcset="/logo.png">
            <img src="/favicon.png" alt="HSN Logo" class="max-w-full h-auto">
          </picture>
        </div>
      </div>
    </div>

    <!-- 下部分：内容 -->
    <div class="content-section">
      <div class="container mx-auto px-4 max-w-6xl">
        <!-- 团队介绍 -->
        <section class="mb-12">
          <h2 class="text-2xl md:text-3xl font-bold text-white mb-6">{{ t('about.teamIntroduction') }}</h2>
          <div class="glass-dark rounded-2xl p-6">
            <p class="text-white/80 leading-relaxed">
              {{ teamIntroductionText }}
            </p>
          </div>
        </section>

        <!-- 团队成员 -->
        <section class="mb-12">
          <h2 class="text-2xl md:text-3xl font-bold text-white mb-6">{{ t('about.teamMembers') }}</h2>
          <div class="glass-dark rounded-2xl p-4 mb-4">
            <p class="text-white/60 text-sm">{{ t('about.teamMembersNote') }}</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <a
              v-for="member in teamMembers"
              :key="member.name"
              :href="member.profileUrl"
              target="_blank"
              class="glass-dark rounded-2xl p-4 hover:scale-105 transition-transform hover:bg-white/5"
            >
              <div class="flex items-center gap-4">
                <img
                  :src="member.avatarUrl"
                  :alt="member.name"
                  class="w-12 h-12 rounded-full ring-2 ring-primary/50"
                />
                <div>
                  <h3 class="text-white font-bold">{{ member.name }}</h3>
                  <p class="text-white/60 text-sm">{{ member.role }}</p>
                </div>
              </div>
            </a>
          </div>
        </section>

        <!-- 问题反馈 -->
        <section class="mb-12">
          <h2 class="text-2xl md:text-3xl font-bold text-white mb-6">{{ t('about.feedback') }}</h2>
          <div class="glass-dark rounded-2xl p-6">
            <p class="text-white/80 mb-4">
              {{ t('about.feedbackText') }}
            </p>
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
                <span class="text-white">{{ t('about.githubIssues') }}</span>
              </div>
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
                <span class="text-white">{{ t('about.qqGroup') }}: 1049578201</span>
              </div>
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span class="text-white">nb3502022@outlook.com</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 捐助我们 -->
        <section class="mb-12">
          <h2 class="text-2xl md:text-3xl font-bold text-white mb-6">{{ t('about.donate') }}</h2>
          <div class="glass-dark rounded-2xl p-6">
            <p class="text-white/80 mb-4">
              {{ t('about.donateText') }}
            </p>
            <a
              href="https://afdian.com/a/HSNetwork"
              target="_blank"
              class="inline-flex items-center gap-2 px-6 py-3 bg-primary/20 text-primary font-bold rounded-xl hover:bg-primary/30 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ t('about.donateButton') }}
            </a>
          </div>
        </section>

        <!-- 加入我们 -->
        <section class="mb-12">
          <h2 class="text-2xl md:text-3xl font-bold text-white mb-6">{{ t('about.joinUs') }}</h2>
          <div class="glass-dark rounded-2xl p-6">
            <p class="text-white/80 mb-4">
              {{ t('about.joinUsText') }}
            </p>
            <a
              href="https://v.wjx.cn/vm/rCUAXVd.aspx"
              target="_blank"
              class="inline-flex items-center gap-2 px-6 py-3 bg-primary/20 text-primary font-bold rounded-xl hover:bg-primary/30 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              {{ t('about.joinUsButton') }}
            </a>
          </div>
        </section>

        <!-- 致谢 -->
        <section class="mb-12">
          <h2 class="text-2xl md:text-3xl font-bold text-white mb-6">{{ t('about.acknowledgements') }}</h2>
          <div class="glass-dark rounded-2xl p-4 mb-4">
            <p class="text-white/60 text-sm">{{ t('about.acknowledgementsNote') }}</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="contributor in contributors"
              :key="contributor.name"
              class="glass-dark rounded-2xl p-4 hover:bg-white/5 transition-colors"
            >
              <div class="flex items-center gap-4">
                <img
                  :src="contributor.avatarUrl"
                  :alt="contributor.name"
                  class="w-10 h-10 rounded-full ring-1 ring-white/20"
                />
                <div>
                  <h3 class="text-white font-bold">{{ contributor.name }}</h3>
                  <p class="text-white/60 text-sm">{{ contributor.contribution }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18nStore } from '@/stores/i18n'
import { getAboutConfig, getLocalizedText } from '@/utils/config'

const { t } = useI18nStore()

// 团队介绍文本
const teamIntroductionText = computed(() => {
  const config = getAboutConfig()
  return getLocalizedText(config.teamIntroduction)
})

// 团队成员数据（从配置加载）
const teamMembers = computed(() => {
  const config = getAboutConfig()
  return config.teamMembers.map(member => ({
    name: member.name,
    role: '开发者', // 角色暂时固定
    avatarUrl: member.avatar,
    profileUrl: member.homepage
  }))
})


// 致谢贡献者数据（从配置加载）
const contributors = computed(() => {
  const config = getAboutConfig()
  return config.acknowledgements.map(ack => ({
    name: ack.name,
    contribution: ack.contribution,
    avatarUrl: `/images/users/user_${ack.avatarId}.jpg`
  }))
})
</script>

<style scoped>
.page-container {
  padding-top: 80px;
  padding-bottom: 40px;
}

.logo-section img {
  max-width: 400px;
  height: auto;
}

@media (max-width: 768px) {
  .logo-section img {
    max-width: 200px;
  }
}
</style>
