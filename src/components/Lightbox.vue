<template>
  <Teleport to="body">
    <transition name="lightbox">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
        @click="close"
      >
        <!-- 图片容器 -->
        <div class="max-w-[90vw] max-h-[90vh] relative" @click.stop>
          <img
            :src="imageUrl"
            :alt="imageAlt"
            class="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
          
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { eventBus } from '@/utils/eventBus'

const isOpen = ref(false)
const imageUrl = ref('')
const imageAlt = ref('')

function openLightbox(url: string, alt: string = '图片') {
  imageUrl.value = url
  imageAlt.value = alt
  isOpen.value = true
  // 禁止页面滚动
  document.body.style.overflow = 'hidden'
}

function close() {
  isOpen.value = false
  // 恢复页面滚动
  document.body.style.overflow = ''
}

// ESC键关闭
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    close()
  }
}

function handleOpenLightbox(data: { url: string; alt?: string }) {
  openLightbox(data.url, data.alt)
}

onMounted(() => {
  eventBus.on('open-lightbox', handleOpenLightbox)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  eventBus.off('open-lightbox', handleOpenLightbox)
  window.removeEventListener('keydown', handleKeydown)
  // 确保恢复滚动
  document.body.style.overflow = ''
})
</script>

<style scoped>
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.3s ease;
}

.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}

.lightbox-enter-active img,
.lightbox-leave-active img {
  transition: transform 0.3s ease;
}

.lightbox-enter-from img,
.lightbox-leave-to img {
  transform: scale(0.8);
}
</style>
