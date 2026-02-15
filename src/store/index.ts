import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'
import { authAPI } from '@/api/auth'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const isLoggedIn = computed(() => user.value !== null)

  async function fetchUser() {
    try {
      user.value = await authAPI.me()
      return true
    } catch {
      user.value = null
      return false
    }
  }

  async function login(username: string, password: string, remember: boolean) {
    user.value = await authAPI.login({ username, password, remember })
  }

  async function logout() {
    await authAPI.logout()
    user.value = null
  }

  function setUser(newUser: User) {
    user.value = newUser
  }

  return {
    user,
    isLoggedIn,
    fetchUser,
    login,
    logout,
    setUser,
  }
})
