<template>
  <Teleport to="body">
    <transition name="window">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-transparent"
        @click="handleBackdropClick"
      >
        <div
          ref="windowRef"
          class="relative glass rounded-2xl shadow-2xl transition-all duration-300"
          :style="windowStyle"
          @click.stop
          @mousemove="handleMouseMove"
          @mouseleave="resetTilt"
        >
          <!-- 关闭按钮 -->
          <button
            ref="closeButtonRef"
            class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 transition-all flex items-center justify-center z-10 shadow-lg"
            @click="close"
            @mouseenter="isNearButton = true"
            @mouseleave="isNearButton = false"
          >
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- 内容区域 -->
          <div class="p-6 overflow-hidden" :style="contentStyle">
            <slot />
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { CSSProperties } from 'vue'

interface Props {
  modelValue: boolean
  width?: string
  height?: string
  maxWidth?: string
  maxHeight?: string
}

const props = withDefaults(defineProps<Props>(), {
  width: '600px',
  maxWidth: '90vw',
  maxHeight: '90vh'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
}>()

const windowRef = ref<HTMLElement>()
const closeButtonRef = ref<HTMLElement>()
const isNearButton = ref(false)

const windowStyle = computed<CSSProperties>(() => ({
  width: props.width,
  maxWidth: props.maxWidth,
  maxHeight: props.maxHeight,
  transformStyle: 'preserve-3d' as 'preserve-3d'
}))

const contentStyle = computed<CSSProperties>(() => ({
  maxHeight: props.height || 'auto',
  overflowY: (props.height ? 'auto' : 'visible') as 'auto' | 'visible'
}))

// 3D倾斜效果 - 添加最大倾斜值限制
function handleMouseMove(event: MouseEvent) {
  if (!windowRef.value || !closeButtonRef.value) return
  if (window.innerWidth < 768) return // 移动端不启用

  const button = closeButtonRef.value
  const buttonRect = button.getBoundingClientRect()
  const mouseX = event.clientX
  const mouseY = event.clientY

  // 检查鼠标是否在关闭按钮区域附近
  const isNearButton =
    mouseX >= buttonRect.left - 80 &&
    mouseX <= buttonRect.right + 80 &&
    mouseY >= buttonRect.top - 80 &&
    mouseY <= buttonRect.bottom + 80

  if (isNearButton) {
    const window = windowRef.value
    const rect = window.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const maxTilt = 5 // 最大倾斜角度
    const angleX = Math.max(-maxTilt, Math.min(maxTilt, (centerY - mouseY) / 40))
    const angleY = Math.max(-maxTilt, Math.min(maxTilt, (mouseX - centerX) / 40))

    window.style.transform = `perspective(1200px) rotateX(${angleX}deg) rotateY(${angleY}deg) scale(1.02)`
  } else {
    resetTilt()
  }
}

function resetTilt() {
  if (windowRef.value) {
    windowRef.value.style.transform = ''
  }
}

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function handleBackdropClick() {
  close()
}

// 禁止body滚动
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

// ESC键关闭
function handleEsc(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) {
    close()
  }
}

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    window.addEventListener('keydown', handleEsc)
  } else {
    window.removeEventListener('keydown', handleEsc)
  }
})
</script>

<style scoped>
/* 窗口动画 */
.window-enter-active,
.window-leave-active {
  transition: opacity 0.3s ease;
}

.window-enter-active > div,
.window-leave-active > div {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.window-enter-from,
.window-leave-to {
  opacity: 0;
}

.window-enter-from > div {
  transform: scale(0.9) translateY(-20px);
  opacity: 0;
}

.window-leave-to > div {
  transform: scale(0.95) rotateX(5deg);
  opacity: 0;
}

/* 自定义滚动条 */
:deep(.overflow-y-auto)::-webkit-scrollbar {
  width: 6px;
}

:deep(.overflow-y-auto)::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

:deep(.overflow-y-auto)::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 10px;
}

:deep(.overflow-y-auto)::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style>
