// 窗口管理器 - 管理窗口层级
import { ref } from 'vue'

// 窗口状态接口
interface WindowInstance {
  id: string
  zIndex: number
  isActive: boolean
  component: any
}

// 全局窗口管理器
class WindowManager {
  private windows = ref<WindowInstance[]>([])
  private baseZIndex = 9998
  private nextId = 1

  // 创建新窗口实例
  createWindow(component: any): string {
    const id = `window-${this.nextId++}`
    const zIndex = this.baseZIndex + this.windows.value.length
    
    this.windows.value.push({
      id,
      zIndex,
      isActive: true,
      component
    })
    
    return id
  }

  // 激活窗口（提升到最前面）
  activateWindow(id: string) {
    // 找到要激活的窗口
    const windowIndex = this.windows.value.findIndex(w => w.id === id)
    if (windowIndex === -1) return

    // 更新所有窗口的z-index
    this.windows.value.forEach((window, index) => {
      if (window.id === id) {
        // 激活的窗口获得最高z-index
        window.zIndex = this.baseZIndex + this.windows.value.length - 1
        window.isActive = true
      } else {
        // 其他窗口依次降低
        window.zIndex = this.baseZIndex + index
        window.isActive = false
      }
    })

    // 将被激活的窗口移到数组末尾（表示在最前面）
    const [window] = this.windows.value.splice(windowIndex, 1)
    this.windows.value.push(window)
  }

  // 获取窗口的z-index
  getZIndex(id: string): number {
    const window = this.windows.value.find(w => w.id === id)
    return window?.zIndex || this.baseZIndex
  }

  // 移除窗口
  removeWindow(id: string) {
    const index = this.windows.value.findIndex(w => w.id === id)
    if (index !== -1) {
      this.windows.value.splice(index, 1)
      // 重新计算剩余窗口的z-index
      this.windows.value.forEach((window, idx) => {
        window.zIndex = this.baseZIndex + idx
      })
    }
  }

  // 获取当前最高z-index
  getHighestZIndex(): number {
    if (this.windows.value.length === 0) return this.baseZIndex
    return Math.max(...this.windows.value.map(w => w.zIndex))
  }

  // 获取窗口数量
  getWindowCount(): number {
    return this.windows.value.length
  }
}

// 导出单例实例
export const windowManager = new WindowManager()