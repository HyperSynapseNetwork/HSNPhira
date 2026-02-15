<template>
  <div ref="canvasContainer" class="fixed inset-0 z-0 pointer-events-none">
    <canvas ref="canvas" class="w-full h-full" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getUserPreference } from '@/utils/config'

const canvas = ref<HTMLCanvasElement>()
const canvasContainer = ref<HTMLElement>()
let ctx: CanvasRenderingContext2D | null = null
let animationId: number
let particles: Particle[] = []

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
}

function initCanvas() {
  if (!canvas.value || !canvasContainer.value) return
  
  const container = canvasContainer.value
  canvas.value.width = container.clientWidth
  canvas.value.height = container.clientHeight
  ctx = canvas.value.getContext('2d')
  
  initParticles()
  animate()
}

function initParticles() {
  const effectType = getUserPreference('particle_effect', 'snow')
  particles = []
  
  const count = 100
  for (let i = 0; i < count; i++) {
    particles.push(createParticle(effectType))
  }
}

function createParticle(type: string): Particle {
  const width = canvas.value?.width || window.innerWidth
  const height = canvas.value?.height || window.innerHeight
  
  if (type === 'snow') {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: Math.random() * 1 + 0.5,
      size: Math.random() * 3 + 1,
      opacity: Math.random() * 0.5 + 0.3,
    }
  } else if (type === 'rain') {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: Math.random() * 5 + 5,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.3 + 0.2,
    }
  } else { // stars
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: 0,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.8 + 0.2,
    }
  }
}

function animate() {
  if (!ctx || !canvas.value) return
  
  const width = canvas.value.width
  const height = canvas.value.height
  const effectType = getUserPreference('particle_effect', 'snow')
  
  ctx.clearRect(0, 0, width, height)
  
  particles.forEach(particle => {
    // 更新位置
    particle.x += particle.vx
    particle.y += particle.vy
    
    // 边界检查
    if (particle.y > height) {
      particle.y = 0
      particle.x = Math.random() * width
    }
    if (particle.x > width) particle.x = 0
    if (particle.x < 0) particle.x = width
    
    // 绘制
    if (ctx) {
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`
      ctx.fill()
    }
    
    // 星星闪烁效果
    if (effectType === 'stars') {
      particle.opacity += (Math.random() - 0.5) * 0.05
      particle.opacity = Math.max(0.2, Math.min(1, particle.opacity))
    }
  })
  
  animationId = requestAnimationFrame(animate)
}

function handleResize() {
  if (canvas.value && canvasContainer.value) {
    canvas.value.width = canvasContainer.value.clientWidth
    canvas.value.height = canvasContainer.value.clientHeight
    initParticles()
  }
}

onMounted(() => {
  initCanvas()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  window.removeEventListener('resize', handleResize)
})
</script>
