<template>
  <div class="container mx-auto px-4 py-24 max-w-6xl">
    <!-- 页面标题 -->
    <div class="glass rounded-3xl p-8 mb-8">
      <h1 class="text-4xl font-bold text-white mb-4 text-center">
        {{ pageTitle }}
      </h1>
      <p class="text-white/60 text-lg text-center max-w-3xl mx-auto">
        {{ pageDescription }}
      </p>
    </div>

    <!-- 文档卡片网格 -->
    <div v-for="category in categories" :key="category.id" class="mb-12">
      <!-- 分类标题 -->
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-white mb-2">
          {{ getCategoryTitle(category.category) }}
        </h2>
        <p class="text-white/60">
          {{ getCategoryDescription(category.category) }}
        </p>
      </div>

      <!-- 该分类下的卡片 -->
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <router-link
          v-for="card in getCardsByCategory(category.id)"
          :key="card.id"
          :to="`/md/${card.id}`"
          class="glass-dark rounded-3xl p-6 hover:scale-[1.02] transition-all duration-300 group block h-full"
          :class="{'bg-gray-800/60': darkMode && !highContrast, 'bg-white/5': highContrast}"
        >
          <div class="flex items-start mb-4">
            <!-- 图标 -->
            <div class="p-3 rounded-2xl bg-primary/10 mr-4 group-hover:bg-primary/20 transition-colors">
              <span class="text-2xl">{{ card.icon }}</span>
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <h3 class="text-xl font-bold text-white mb-2 line-clamp-2">
                  {{ getCardTitle(card) }}
                </h3>
                <svg class="w-5 h-5 text-white/40 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
              <p class="text-white/60 text-sm line-clamp-3">
                {{ getCardDescription(card) }}
              </p>
            </div>
          </div>
          
          <!-- 标签（显示分类） -->
          <div class="mt-4 pt-4 border-t border-white/10">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {{ getCategoryTitleById(card.category) }}
            </span>
          </div>
        </router-link>
      </div>
    </div>

    <!-- 无卡片提示 -->
    <div v-if="categories.length === 0" class="text-center py-16">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
        <svg class="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 class="text-xl font-bold text-white mb-2">
        {{ t('docs.noDocuments') }}
      </h3>
      <p class="text-white/60">
        {{ t('docs.noDocumentsDescription') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useI18nStore } from '@/stores/i18n'
import { useThemeStore } from '@/stores/theme'
import {
  loadDocsConfig,
  getAllCategories,
  getCardsByCategory,
  getCurrentLanguageDoc,
  getCategory as getCategoryById
} from '@/utils/docs'
import type { DocCard, DocCategory } from '@/types'

const { t } = useI18nStore()
const themeStore = useThemeStore()

const categories = ref<Array<{id: string, category: DocCategory}>>([])
const pageTitle = ref(t('docs.homeTitle'))
const pageDescription = ref(t('docs.homeDescription'))

const darkMode = computed(() => themeStore.isDarkMode)
const highContrast = computed(() => themeStore.isHighContrastMode)

async function loadContent() {
  try {
    await loadDocsConfig()
    categories.value = getAllCategories()
    
    // 更新页面标题和描述
    pageTitle.value = t('docs.homeTitle')
    pageDescription.value = t('docs.homeDescription')
  } catch (error) {
    console.error('Error loading docs:', error)
  }
}


function getCategoryTitle(category: DocCategory) {
  return getCurrentLanguageDoc(category.title)
}

function getCategoryDescription(category: DocCategory) {
  return getCurrentLanguageDoc(category.description)
}

function getCategoryTitleById(categoryId: string) {
  const category = getCategoryById(categoryId)
  return category ? getCurrentLanguageDoc(category.title) : categoryId
}

function getCardTitle(card: DocCard) {
  return getCurrentLanguageDoc(card.title)
}

function getCardDescription(card: DocCard) {
  return getCurrentLanguageDoc(card.description)
}

onMounted(() => {
  loadContent()
})

// 监听语言变化
watch(() => useI18nStore().currentLanguage, () => {
  loadContent()
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 深色模式和高对比度模式适配 */
:deep(.glass) {
  background: var(--glass-bg, rgba(255, 255, 255, 0.05));
  backdrop-filter: var(--glass-blur, blur(20px));
  border: var(--glass-border, 1px solid rgba(255, 255, 255, 0.1));
}

:deep(.glass-dark) {
  background: var(--glass-dark-bg, rgba(255, 255, 255, 0.03));
  backdrop-filter: var(--glass-blur, blur(20px));
  border: var(--glass-border, 1px solid rgba(255, 255, 255, 0.05));
}

/* 高对比度模式覆盖 */
:deep(.high-contrast .glass),
:deep(.high-contrast .glass-dark) {
  background: var(--card-bg, rgba(255, 255, 255, 0.1)) !important;
  backdrop-filter: none !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}
</style>