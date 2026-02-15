<template>
  <div class="container mx-auto px-4 py-24 max-w-2xl">
    <h1 class="text-4xl font-bold text-white text-center mb-12">谱面下载工具</h1>

    <!-- 输入框 -->
    <div class="glass rounded-3xl p-8 mb-8">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-white text-lg mb-2">输入谱面ID</label>
          <input
            v-model="chartId"
            type="text"
            placeholder="例如: 12345"
            class="w-full px-4 py-3 rounded-lg glass text-white text-lg outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
        
        <Button type="submit" class="w-full !py-3 !text-lg" :disabled="isLoading">
          {{ isLoading ? '查询中...' : '查询并下载' }}
        </Button>
      </form>
    </div>

    <!-- 使用说明 -->
    <div class="glass rounded-3xl p-8">
      <h2 class="text-2xl font-bold text-white mb-6">使用说明</h2>
      
      <div class="text-white/80 space-y-4 leading-relaxed">
        <div>
          <h3 class="font-bold text-white mb-2">1. 如何获取谱面ID？</h3>
          <ol class="list-decimal list-inside space-y-2 ml-4">
            <li>
              访问
              <a
                href="https://phira.moe/chart"
                target="_blank"
                class="text-primary glow-on-hover"
              >
                https://phira.moe/chart
              </a>
            </li>
            <li>搜索并找到你想要下载的谱面</li>
            <li>点击谱面进入详情页</li>
            <li>查看浏览器地址栏，URL格式为 https://phira.moe/chart/谱面ID</li>
            <li>地址栏中 /chart/ 后面的数字就是谱面ID</li>
          </ol>
        </div>

        <div>
          <h3 class="font-bold text-white mb-2">2. 如何使用本工具？</h3>
          <ol class="list-decimal list-inside space-y-2 ml-4">
            <li>在上方输入框中输入谱面ID</li>
            <li>点击"查询并下载"按钮</li>
            <li>系统会自动验证谱面是否存在</li>
            <li>验证通过后会打开谱面详情窗口</li>
            <li>在窗口中可以查看谱面信息并下载</li>
          </ol>
        </div>

        <div class="glass-dark rounded-xl p-4">
          <h4 class="font-bold text-white mb-2">示例</h4>
          <p>如果谱面页面地址是：https://phira.moe/chart/12345</p>
          <p class="mt-2">那么谱面ID就是：<code class="text-primary font-mono">12345</code></p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { chartsAPI } from '@/api/charts'
import { showError } from '@/utils/message'
import { eventBus } from '@/utils/eventBus'
import Button from '@/components/common/Button.vue'

const chartId = ref('')
const isLoading = ref(false)

async function handleSubmit() {
  const id = parseInt(chartId.value.trim())
  
  if (isNaN(id) || id <= 0) {
    showError('错误', '请输入有效的谱面ID')
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
    showError('错误', '谱面不存在或无法访问')
  } finally {
    isLoading.value = false
  }
}
</script>
