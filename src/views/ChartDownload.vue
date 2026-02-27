<template>
  <div class="container mx-auto px-4 py-24 max-w-2xl">
    <h1 class="text-4xl font-bold text-white text-center mb-12">{{ t('chartDownload.title') }}</h1>

    <!-- 输入框 -->
    <div class="glass rounded-3xl p-8 mb-8">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-white text-lg mb-2">{{ t('chartDownload.chartId') }}</label>
          <input
            v-model="chartId"
            type="text"
            :placeholder="t('chartDownload.chartIdPlaceholder')"
            class="w-full px-4 py-3 rounded-lg glass text-white text-lg outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <Button type="submit" class="w-full !py-3 !text-lg" :disabled="isLoading">
          {{ isLoading ? t('common.loading') : t('chartDownload.queryAndDownload') }}
        </Button>
      </form>
    </div>

    <!-- 使用说明 -->
    <div class="glass rounded-3xl p-8">
      <h2 class="text-2xl font-bold text-white mb-6">{{ t('chartDownload.instructions') }}</h2>

      <div class="text-white/80 space-y-4 leading-relaxed">
        <div>
          <h3 class="font-bold text-white mb-2">{{ t('chartDownload.howToGetId') }}</h3>
          <ol class="list-decimal list-inside space-y-2 ml-4">
            <li>
              {{ t('chartDownload.visit') }}
              <a
                href="https://phira.moe/chart"
                target="_blank"
                class="text-primary glow-on-hover"
              >
                https://phira.moe/chart
              </a>
            </li>
            <li>{{ t('chartDownload.searchAndFind') }}</li>
            <li>{{ t('chartDownload.clickToDetail') }}</li>
            <li>{{ t('chartDownload.checkUrlFormat') }}</li>
            <li>{{ t('chartDownload.idAfterChart') }}</li>
          </ol>
        </div>

        <div>
          <h3 class="font-bold text-white mb-2">{{ t('chartDownload.howToUse') }}</h3>
          <ol class="list-decimal list-inside space-y-2 ml-4">
            <li>{{ t('chartDownload.enterIdAbove') }}</li>
            <li>{{ t('chartDownload.clickQueryButton') }}</li>
            <li>{{ t('chartDownload.waitForQuery') }}</li>
            <li>{{ t('chartDownload.clickDownloadInWindow') }}</li>
          </ol>
        </div>

        <div class="glass-dark rounded-xl p-4">
          <h4 class="font-bold text-white mb-2">{{ t('chartDownload.example') }}</h4>
          <p>{{ t('chartDownload.exampleUrl') }}</p>
          <p class="mt-2">{{ t('chartDownload.exampleId') }} <code class="text-primary font-mono">12345</code></p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18nStore } from '@/stores/i18n'
import { chartsAPI } from '@/api/charts'
import { showError } from '@/utils/message'
import { eventBus } from '@/utils/eventBus'
import Button from '@/components/common/Button.vue'

const { t } = useI18nStore()

const chartId = ref('')
const isLoading = ref(false)

async function handleSubmit() {
  const id = parseInt(chartId.value.trim())
  
  if (isNaN(id) || id <= 0) {
    showError(t('common.error'), t('chartDownload.enterValidId'))
    return
  }

  isLoading.value = true

  try {
    // 验证谱面是否存在
    await chartsAPI.getChartDetail(id)
    
    // 打开谱面窗口
    eventBus.emit('open-chart', id)
    
    // 清空输入
    chartId.value = ''
  } catch (error) {
    showError(t('common.error'), t('chartDownload.chartNotFound'))
  } finally {
    isLoading.value = false
  }
}
</script>
