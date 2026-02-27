<template>
  <div class="fixed bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 z-40 w-full px-2 md:px-0 max-w-full">
    <div 
      class="flex items-center justify-center gap-1.5 md:gap-4 px-3 md:px-8 py-1.5 md:py-3 rounded-full glass backdrop-blur-md transition-all duration-300 hover:shadow-glow text-[10px] md:text-sm mx-auto w-fit max-w-full group"
    >
      <!-- 版权信息 -->
      <div class="text-white/80 whitespace-nowrap transition-all duration-300 group-hover:text-white group-hover:text-shadow-glow truncate">
        {{ t('footer.copyright') }}
      </div>

      <!-- 分隔线 -->
      <div class="w-px h-3 md:h-6 bg-white/20 flex-shrink-0" />

      <!-- 关于我们按钮 -->
      <router-link
        to="/about"
        class="px-2 md:px-4 py-1 md:py-1.5 rounded-lg hover:bg-white/10 transition-all duration-300 text-white/80 hover:text-white whitespace-nowrap hover:text-shadow-glow flex-shrink-0"
      >
        {{ t('footer.about') }}
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18nStore } from '@/stores/i18n'

const { t } = useI18nStore()
</script>

<style scoped>
.shadow-glow {
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.3),
              0 0 40px rgba(255, 255, 255, 0.15);
}

.text-shadow-glow {
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.6),
               0 0 12px rgba(255, 255, 255, 0.4);
}
</style>
