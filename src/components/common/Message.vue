<template>
  <teleport to="body">
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-3">
      <transition-group name="message">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message-card glass backdrop-blur-lg rounded-2xl p-4 min-w-[280px] md:min-w-[300px] max-w-[400px] md:max-w-[500px] relative animate-scale-in shadow-lg"
        >
          <!-- 关闭按钮 -->
          <button
            class="absolute top-2 right-2 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
            @click="removeMessage(msg.id)"
          />
          
          <!-- 标题 -->
          <div class="text-white font-bold text-lg mb-2">
            {{ msg.title }}
          </div>
          
          <!-- 内容 -->
          <div class="text-white/90 text-sm break-words">
            {{ msg.content }}
          </div>
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { eventBus } from '@/utils/eventBus'
import type { Message } from '@/types'

interface MessageWithId extends Message {
  id: number
}

const messages = ref<MessageWithId[]>([])
let messageId = 0
const messageQueue: MessageWithId[] = []
let isProcessing = false

const DEFAULT_DURATION = 3000

function addMessage(message: Message) {
  const msg: MessageWithId = {
    ...message,
    id: messageId++,
    duration: message.duration || DEFAULT_DURATION,
  }
  
  messageQueue.push(msg)
  processQueue()
}

function processQueue() {
  if (isProcessing || messageQueue.length === 0) return
  
  isProcessing = true
  const msg = messageQueue.shift()!
  
  messages.value.push(msg)
  
  // 自动关闭
  setTimeout(() => {
    removeMessage(msg.id)
  }, msg.duration)
  
  // 允许下一个消息
  setTimeout(() => {
    isProcessing = false
    processQueue()
  }, 100)
}

function removeMessage(id: number) {
  const index = messages.value.findIndex(m => m.id === id)
  if (index !== -1) {
    messages.value.splice(index, 1)
  }
}

function handleShowMessage(message: Message) {
  addMessage(message)
}

onMounted(() => {
  eventBus.on('show-message', handleShowMessage)
})

onUnmounted(() => {
  eventBus.off('show-message', handleShowMessage)
})
</script>

<style scoped>
.message-card {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.message-enter-active {
  animation: slideInRight 0.3s ease-out;
}

.message-leave-active {
  animation: slideOutRight 0.3s ease-in;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOutRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
</style>
