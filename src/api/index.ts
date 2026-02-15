import axios from 'axios'
import { getBaseURL } from '@/utils/config'
import { showError } from '@/utils/message'

const api = axios.create({
  timeout: 30000,
  withCredentials: true,
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    try {
      // 在开发环境，如果使用代理，不需要设置baseURL
      // 因为Vite会自动代理 /api 开头的请求
      if (import.meta.env.DEV) {
        // 开发环境使用Vite代理，不设置baseURL
        // Vite会将 /api/* 代理到后端服务器
      } else {
        // 生产环境设置完整的baseURL
        config.baseURL = getBaseURL()
      }
    } catch (error) {
      console.error('Failed to get base URL:', error)
      // 如果获取baseURL失败，使用默认值
      config.baseURL = ''
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.code === 'ERR_NETWORK') {
      console.error('Network error - 请确保后端服务器正在运行')
      showError('网络错误', '无法连接到服务器，请检查后端服务是否运行')
    } else {
      const message = error.response?.data?.message || error.message || '请求失败'
      console.error('API Error:', message)
      showError('请求错误', message)
    }
    return Promise.reject(error)
  }
)

export default api
