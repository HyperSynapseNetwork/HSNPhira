import { eventBus } from './eventBus'
import type { Message } from '@/types'

export const PRESET_COLORS = {
  INFO: '#3b82f6',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
}

export function showMessage(message: Message): void {
  eventBus.emit('show-message', message)
}

export function showInfo(title: string, content: string): void {
  showMessage({
    title,
    content,
    backgroundColor: PRESET_COLORS.INFO,
  })
}

export function showSuccess(title: string, content: string): void {
  showMessage({
    title,
    content,
    backgroundColor: PRESET_COLORS.SUCCESS,
  })
}

export function showWarning(title: string, content: string): void {
  showMessage({
    title,
    content,
    backgroundColor: PRESET_COLORS.WARNING,
  })
}

export function showError(title: string, content: string): void {
  showMessage({
    title,
    content,
    backgroundColor: PRESET_COLORS.ERROR,
  })
}

export function copyToClipboard(text: string, successMessage = '复制成功'): void {
  navigator.clipboard.writeText(text).then(
    () => {
      showSuccess('成功', successMessage)
    },
    () => {
      showError('错误', '复制失败')
    }
  )
}
