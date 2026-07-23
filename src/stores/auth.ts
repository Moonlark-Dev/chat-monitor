import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const baseURL = ref(localStorage.getItem('chat_monitor_base_url') || '')
  const accessToken = ref(localStorage.getItem('chat_monitor_access_token') || '')

  const isLoggedIn = computed(() => !!baseURL.value && !!accessToken.value)

  function login(url: string, token: string) {
    baseURL.value = url.replace(/\/+$/, '')
    accessToken.value = token
    localStorage.setItem('chat_monitor_base_url', baseURL.value)
    localStorage.setItem('chat_monitor_access_token', accessToken.value)
  }

  function logout() {
    baseURL.value = ''
    accessToken.value = ''
    localStorage.removeItem('chat_monitor_base_url')
    localStorage.removeItem('chat_monitor_access_token')
  }

  return { baseURL, accessToken, isLoggedIn, login, logout }
})
