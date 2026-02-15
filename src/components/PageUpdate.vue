<template>
  <div />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { getAppConfig, getUserPreferences, saveUserPreferences } from '@/utils/config'
import { showInfo, showSuccess } from '@/utils/message'

interface Version {
  appVersion: string
  policyVersion: string
}

onMounted(async () => {
  await checkVersion()
})

async function checkVersion() {
  try {
    const config = getAppConfig()
    const versionUrl = config.versionFileURL
    
    // 获取云端版本
    const response = await fetch(`${versionUrl}?t=${Date.now()}`)
    const cloudVersion: Version = await response.json()
    
    // 获取本地版本
    const localAppVersion = localStorage.getItem('hsn_app_version')
    const localPolicyVersion = localStorage.getItem('hsn_policy_version')
    
    // 检查应用版本更新
    if (localAppVersion && localAppVersion !== cloudVersion.appVersion) {
      handleAppUpdate(cloudVersion.appVersion)
    } else if (!localAppVersion) {
      // 首次访问
      localStorage.setItem('hsn_app_version', cloudVersion.appVersion)
      localStorage.setItem('hsn_policy_version', cloudVersion.policyVersion)
    }
    
    // 检查协议版本更新
    if (localPolicyVersion && localPolicyVersion !== cloudVersion.policyVersion) {
      handlePolicyUpdate(cloudVersion.policyVersion)
    }
    
    // 检查是否需要清除缓存
    if (localStorage.getItem('hsn_cache_invalid') === 'true') {
      handleCacheRefresh()
    }
  } catch (error) {
    console.error('Version check failed:', error)
  }
}

function handleAppUpdate(newVersion: string) {
  // 设置缓存失效标记
  localStorage.setItem('hsn_cache_invalid', 'true')
  
  // 保存用户偏好
  const preferences = getUserPreferences()
  localStorage.setItem('hsn_user_preferences_backup', JSON.stringify(preferences))
  
  // 更新版本号
  localStorage.setItem('hsn_app_version', newVersion)
  
  // 提示用户
  showInfo('更新提示', '检测到新版本，下次访问时将自动更新')
}

function handlePolicyUpdate(newVersion: string) {
  localStorage.setItem('hsn_policy_version', newVersion)
  showInfo('协议更新', '用户协议已更新，请查看最新协议内容')
}

function handleCacheRefresh() {
  try {
    // 恢复用户偏好
    const backup = localStorage.getItem('hsn_user_preferences_backup')
    if (backup) {
      const preferences = JSON.parse(backup)
      saveUserPreferences(preferences)
      localStorage.removeItem('hsn_user_preferences_backup')
    }
    
    // 清除缓存标记
    localStorage.removeItem('hsn_cache_invalid')
    
    // 提示完成
    showSuccess('更新完成', '页面已更新到最新版本')
    
    // 清除Service Worker缓存（如果有）
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          if (name.startsWith('hsn-')) {
            caches.delete(name)
          }
        })
      })
    }
  } catch (error) {
    console.error('Cache refresh failed:', error)
  }
}
</script>
