<template>
  <button
    :class="[
      'capsule-button',
      'inline-flex items-center justify-center',
      'text-white font-medium',
      'glow-on-hover',
      'group overflow-hidden relative',
      sizeClass,
      { 'opacity-50 cursor-not-allowed': disabled }
    ]"
    :disabled="disabled"
    @click="handleClick"
  >
    <span class="inline-block max-w-[200px] overflow-hidden">
      <span class="inline-block whitespace-nowrap group-hover:animate-text-scroll">
        <slot />
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  disabled: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'px-3 py-1 text-sm'
    case 'lg':
      return 'px-6 py-3 text-lg'
    default:
      return 'px-4 py-2'
  }
})

function handleClick(event: MouseEvent) {
  if (!props.disabled) {
    emit('click', event)
  }
}
</script>

<style scoped>
@keyframes text-scroll {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-100%);
  }
}

.animate-text-scroll {
  animation: text-scroll 3s linear infinite;
}
</style>
