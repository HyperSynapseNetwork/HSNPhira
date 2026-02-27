<template>
  <div class="fixed inset-0 z-[-1] overflow-hidden">
    <img
      v-if="backgroundUrl"
      :src="backgroundUrl"
      alt="Background"
      class="w-full h-full object-cover opacity-80"
      :style="imageStyle"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import { getAppConfig, getUserPreference } from '@/utils/config'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

const backgroundUrl = computed(() => {
  // 高对比度模式下不显示背景图片，使用纯色背景
  if (themeStore.isHighContrastMode) {
    return ''
  }

  const userBg = getUserPreference('background_image', '')
  if (userBg) return userBg

  try {
    const config = getAppConfig()
    return config.background.defaultImageURL
  } catch {
    return 'https://webstatic.cn-nb1.rains3.com/5712×3360.jpeg'
  }
})

const imageStyle = computed<CSSProperties>(() => ({
  objectFit: 'cover',
  objectPosition: 'center',
}))
</script>
