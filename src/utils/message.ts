import { eventBus } from './eventBus'
import type { Message } from '@/types'
import { useI18nStore } from '@/stores/i18n'

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

export function copyToClipboard(text: string, successMessage?: string): void {
  const { t } = useI18nStore()
  const finalSuccessMessage = successMessage || t('common.copySuccess')
  navigator.clipboard.writeText(text).then(
    () => {
      showSuccess(t('common.success'), finalSuccessMessage)
    },
    () => {
      showError(t('common.error'), t('common.copyFailed'))
    }
  )
}
