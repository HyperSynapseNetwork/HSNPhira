import { reactive } from 'vue'
import { appConfig } from '../config/appConfig'

let topZ = 100

function loadState(id: string) {
  if (!appConfig.experimental.windowPersistence) return null
  const raw = localStorage.getItem('window:' + id)
  return raw ? JSON.parse(raw) : null
}

function saveState(id: string, state: any) {
  if (!appConfig.experimental.windowPersistence) return
  localStorage.setItem('window:' + id, JSON.stringify(state))
}

export const windowManager = reactive({
  windows: {} as Record<string, any>,
  dock: [] as string[],

  register(id: string) {
    const saved = loadState(id)

    this.windows[id] = {
      z: ++topZ,
      focused: true,
      minimized: false,
      maximized: false,
      x: saved?.x ?? 120,
      y: saved?.y ?? 120,
      width: saved?.width ?? 480,
      height: saved?.height ?? 320
    }

    this.focus(id)
  },

  unregister(id: string) {
    delete this.windows[id]
  },

  focus(id: string) {
    if (!this.windows[id]) return
    this.windows[id].z = ++topZ
    Object.keys(this.windows).forEach(w => {
      this.windows[w].focused = false
    })
    this.windows[id].focused = true
  },

  minimize(id: string) {
    this.windows[id].minimized = true
    if (!this.dock.includes(id)) this.dock.push(id)
  },

  restore(id: string) {
    this.windows[id].minimized = false
    this.focus(id)
    this.dock = this.dock.filter(w => w !== id)
  },

  maximize(id: string) {
    this.windows[id].maximized = !this.windows[id].maximized
  },

  updatePosition(id: string, x: number, y: number) {
    const win = this.windows[id]
    win.x = x
    win.y = y
    saveState(id, win)
  },

  get(id: string) {
    return this.windows[id]
  }
})
