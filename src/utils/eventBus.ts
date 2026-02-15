type EventCallback = (...args: any[]) => void

class EventBus {
  private events: Map<string, EventCallback[]>

  constructor() {
    this.events = new Map()
  }

  on(event: string, callback: EventCallback) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event)!.push(callback)
  }

  off(event: string, callback: EventCallback) {
    if (!this.events.has(event)) return
    const callbacks = this.events.get(event)!
    const index = callbacks.indexOf(callback)
    if (index > -1) {
      callbacks.splice(index, 1)
    }
  }

  emit(event: string, ...args: any[]) {
    if (!this.events.has(event)) return
    const callbacks = this.events.get(event)!
    callbacks.forEach(callback => callback(...args))
  }

  once(event: string, callback: EventCallback) {
    const wrapper = (...args: any[]) => {
      callback(...args)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }
}

export const eventBus = new EventBus()
