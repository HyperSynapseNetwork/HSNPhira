<template>
  <div class="container mx-auto px-4 py-24 max-w-5xl">
    <!-- 毛玻璃卡片容器 -->
    <div class="glass rounded-3xl p-8">
      <!-- 返回按钮 -->
      <div class="mb-8">
        <router-link to="/md" class="inline-flex items-center text-white/60 hover:text-white transition-colors group">
          <svg class="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {{ t('docs.backToDocs') }}
        </router-link>
      </div>

      <!-- 页面标题 -->
      <div class="glass-dark rounded-2xl p-6 mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">{{ pageTitle }}</h1>
        <p class="text-white/60 text-lg">{{ pageDescription }}</p>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="text-center py-16">
        <div class="inline-flex items-center">
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-white/80 text-lg">{{ t('common.loading') }}</span>
        </div>
      </div>

      <!-- 内容为空状态 -->
      <div v-else-if="!hasContent" class="text-center py-16">
        <div class="glass-dark rounded-2xl p-8 inline-block">
          <svg class="w-16 h-16 mx-auto mb-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 class="text-xl font-bold text-white mb-2">{{ t('docs.pageNotFound') }}</h2>
          <p class="text-white/60">{{ t('docs.pageNotFoundDesc') }}</p>
          <div class="mt-6">
            <router-link to="/md" class="inline-flex items-center px-4 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-white">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {{ t('docs.backToDocs') }}
            </router-link>
          </div>
        </div>
      </div>

      <!-- 文档内容 -->
      <div v-else class="glass-dark rounded-2xl p-8">
        <div class="prose prose-invert max-w-none" v-html="renderedContent"></div>
      </div>

      <!-- 导航工具栏 -->
      <div v-if="!isLoading && hasContent" class="mt-12 pt-8 border-t border-white/20 flex flex-col sm:flex-row justify-between items-center gap-6">
        <div class="text-sm text-white/60">
          {{ t('docs.lastUpdated') }}: {{ formatDate(new Date()) }}
        </div>
        <div class="flex gap-3">
          <button
            @click="copyPageLink"
            class="inline-flex items-center px-4 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-white text-sm"
            :title="t('docs.copyLink')"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {{ t('docs.copyLink') }}
          </button>
          <router-link to="/md" class="inline-flex items-center px-4 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-white text-sm">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {{ t('docs.backToDocs') }}
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18nStore } from '@/stores/i18n'
import { loadDocsConfig, getDocPage, getCurrentLanguageDoc, loadDocContent, parseMarkdown } from '@/utils/docs'
import { copyToClipboard } from '@/utils/message'

const route = useRoute()
const { t } = useI18nStore()

const isLoading = ref(true)
const pageTitle = ref('')
const pageDescription = ref('')
const renderedContent = ref('')

const pageId = computed(() => route.params.pageId as string)

const hasContent = computed(() => {
  return renderedContent.value && renderedContent.value.trim().length > 0
})

async function loadPageContent() {
  isLoading.value = true

  try {
    await loadDocsConfig()
    const page = getDocPage(pageId.value)

    if (page) {
      pageTitle.value = getCurrentLanguageDoc(page.title)
      pageDescription.value = getCurrentLanguageDoc(page.description)
      
      // 使用loadDocContent加载内容（支持文件和内联内容）
      const content = await loadDocContent(pageId.value)
      console.log('Loaded content:', content?.substring(0, 100))
      console.log('Content type:', typeof content)
      const parsed = await parseMarkdown(content)
      console.log('Parsed markdown type:', typeof parsed)
      console.log('Parsed markdown:', parsed?.substring(0, 100))
      
      // 确保parsed是字符串
      if (typeof parsed !== 'string') {
        console.error('parseMarkdown did not return string:', parsed)
        renderedContent.value = '<p class="text-red-400">文档解析错误：返回类型不是字符串</p>'
      } else {
        renderedContent.value = parsed
      }
    } else {
      pageTitle.value = t('docs.pageNotFound')
      pageDescription.value = t('docs.pageNotFoundDesc')
      renderedContent.value = ''
    }
  } catch (error) {
    console.error('Error loading doc page:', error)
    pageTitle.value = t('docs.errorLoading')
    pageDescription.value = t('docs.errorLoadingDesc')
    renderedContent.value = ''
  } finally {
    isLoading.value = false
  }
}

function copyPageLink() {
  const url = window.location.href
  copyToClipboard(url, t('docs.linkCopied'))
}

function formatDate(date: Date) {
  const i18nStore = useI18nStore()
  const languageMap: Record<string, string> = {
    'zh': 'zh-CN',
    'zh-TW': 'zh-TW',
    'en': 'en-US',
    'ja': 'ja-JP'
  }
  
  return date.toLocaleDateString(languageMap[i18nStore.currentLanguage] || 'zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

onMounted(() => {
  loadPageContent()
})

// 监听语言变化
watch(() => useI18nStore().currentLanguage, () => {
  loadPageContent()
})

// 监听路由参数变化
watch(() => route.params.pageId, () => {
  loadPageContent()
})
</script>

<style scoped>
.prose :deep(h1) {
  @apply text-3xl font-bold text-white mt-0 mb-8 pb-4 border-b border-white/20;
}

.prose :deep(h2) {
  @apply text-2xl font-bold text-white mt-10 mb-6;
}

.prose :deep(h3) {
  @apply text-xl font-bold text-white mt-8 mb-4;
}

.prose :deep(h4) {
  @apply text-lg font-bold text-white mt-6 mb-3;
}

.prose :deep(p) {
  @apply text-white/80 mb-6 leading-relaxed;
}

.prose :deep(a) {
  @apply text-primary hover:text-primary hover:opacity-80 underline transition-colors;
}

.prose :deep(code) {
  @apply bg-gray-800/50 px-1.5 py-0.5 rounded text-white/90 font-mono text-sm;
}

.prose :deep(pre) {
  @apply bg-gray-900/50 rounded-lg p-4 my-6 overflow-x-auto border border-white/10;
}

.prose :deep(pre code) {
  @apply bg-transparent p-0;
}

.prose :deep(ul) {
  @apply list-disc ml-6 my-6 space-y-2;
}

.prose :deep(ol) {
  @apply list-decimal ml-6 my-6 space-y-2;
}

.prose :deep(li) {
  @apply text-white/80 pl-1;
}

.prose :deep(li > p) {
  @apply mb-2;
}

.prose :deep(blockquote) {
  @apply border-l-4 border-primary border-opacity-50 pl-6 my-6 text-white/70 italic bg-white/5 py-4 rounded-r-lg;
}

.prose :deep(hr) {
  @apply my-8 border-white/20;
}

.prose :deep(table) {
  @apply w-full my-6 border-collapse border border-white/20 rounded-lg overflow-hidden;
}

.prose :deep(th) {
  @apply bg-gray-800/30 text-white font-bold px-4 py-3 border border-white/20 text-left;
}

.prose :deep(td) {
  @apply px-4 py-3 border border-white/20 text-white/80;
}

.prose :deep(img) {
  @apply rounded-lg my-6 max-w-full mx-auto;
}

/* 自定义HTML动画样式 - 增强支持 */
.prose :deep(.animation-container) {
  @apply my-8 p-6 bg-primary bg-opacity-5 rounded-xl border-primary border-opacity-20 border;
  backdrop-filter: blur(10px);
}

.prose :deep(.animation-container h4) {
  @apply text-lg font-bold text-primary mb-3 mt-0;
}

.prose :deep(.animation-container p) {
  @apply text-white/80 mb-4;
}

/* 代码块行号 */
.prose :deep(pre) {
  counter-reset: line;
}

.prose :deep(pre .line) {
  counter-increment: line;
}

.prose :deep(pre .line::before) {
  content: counter(line);
  @apply inline-block w-8 text-right mr-4 text-white/30 text-sm;
  user-select: none;
}

/* 高对比度模式适配 */
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