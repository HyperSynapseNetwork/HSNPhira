<template>
  <div class="container mx-auto px-4 py-24 max-w-4xl">
    <div class="glass rounded-3xl p-8 text-center">
      <h1 class="text-8xl font-bold text-white mb-6">{{ t('common.notFoundTitle') }}</h1>
      <p class="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
        {{ t('common.notFoundDescription') }}
      </p>
      <div class="mt-10">
        <router-link
          :to="{ name: 'Home' }"
          class="inline-block px-8 py-3 rounded-xl glass text-white font-medium hover:scale-105 hover:shadow-lg transition-all text-lg"
        >
          {{ t('common.goHome') }}
        </router-link>
      </div>
      <p class="text-white/60 text-sm mt-8">
        {{ countdown }} 秒后自动跳转...
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18nStore } from '@/stores/i18n'

const router = useRouter()
const { t } = useI18nStore()
const countdown = ref(5)

let timer: number | null = null

onMounted(() => {
  timer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      if (timer) clearInterval(timer)
      router.push({ name: 'Home' })
    }
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>
