<template>
  <div class="container mx-auto px-4 py-24">
    <h1 class="text-4xl font-bold text-white text-center mb-12">{{ t('nav.navigation') }}</h1>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="text-center py-12">
      <div class="inline-flex items-center">
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-white/80">{{ t('common.loading') }}</span>
      </div>
    </div>

    <!-- 卡片组列表 -->
    <div v-else>
      <div v-for="group in cardGroups" :key="group.id" class="mb-12">
        <h2 class="text-2xl font-bold text-white mb-6">{{ group.name }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <button
            v-for="card in getCardsByGroupId(group.id)"
            :key="card.url"
            class="glass rounded-2xl p-6 hover:scale-105 hover:shadow-2xl transition-all group text-left"
            @click="openLink(card.url)"
          >
            <h3 class="text-xl font-bold text-white mb-2 glow-on-hover">
              {{ card.title }}
            </h3>
            <p class="text-white/60 text-sm break-all">
              {{ card.url }}
            </p>
          </button>
        </div>
      </div>
    </div>

    <div class="mt-12">
      <div class="glass rounded-2xl p-6 text-center shadow-2xl">
        <p class="text-white/80 text-sm">
          {{ t('navigation.tip') }}
          <a href="mailto:nb3502022@outlook.com" class="text-primary glow-on-hover font-medium">
            nb3502022@outlook.com
          </a>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useI18nStore } from '@/stores/i18n'
import { loadNavigationConfig, getNavigationConfig, getLocalizedText } from '@/utils/config'

const { t, currentLanguage } = useI18nStore()

const isLoading = ref(false)
const navigationConfig = ref<any>(null)

// 加载配置
async function loadConfig() {
  try {
    isLoading.value = true
    await loadNavigationConfig()
    navigationConfig.value = getNavigationConfig()
  } catch (error) {
    console.error('Failed to load navigation config:', error)
  } finally {
    isLoading.value = false
  }
}

// 获取卡片组
const cardGroups = computed(() => {
  if (!navigationConfig.value) return []
  return navigationConfig.value.cardGroups.map((group: any) => ({
    id: group.id,
    name: getLocalizedText(group.name)
  }))
})

// 根据卡片组ID获取卡片
const getCardsByGroupId = computed(() => {
  return (groupId: string) => {
    if (!navigationConfig.value) return []
    return navigationConfig.value.cards
      .filter((card: any) => card.groupId === groupId)
      .map((card: any) => ({
        title: getLocalizedText(card.title),
        url: card.link
      }))
  }
})

onMounted(() => {
  loadConfig()
})

// 监听语言变化
watch(() => currentLanguage, () => {
  if (navigationConfig.value) {
    // 强制重新计算
    navigationConfig.value = { ...navigationConfig.value }
  }
})

function openLink(url: string) {
  window.open(url, '_blank')
}
</script>
