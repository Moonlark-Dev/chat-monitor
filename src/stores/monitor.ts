import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MoonlarkStatus, SessionInfo, MoodData, EgoState } from '../types'
import { computeHash, getStatus } from '../api/client'
import { useAuthStore } from './auth'

export const useMonitorStore = defineStore('monitor', () => {
  // WebSocket connection
  const ws = ref<WebSocket | null>(null)
  const wsConnected = ref(false)
  const wsError = ref('')

  // Status data from WebSocket broadcast
  const serverTime = ref('')
  const mood = ref<MoodData>({ emotion: 'calm', intensity: 0, reason: '' })
  const sessions = ref<SessionInfo[]>([])
  const ego = ref<EgoState | null>(null)
  const wsConnections = ref(0)

  function connect() {
    const auth = useAuthStore()
    if (!auth.isLoggedIn) return

    // 使用 REST API 轮询作为 fallback（当 WebSocket 连不上时）
    // 先尝试 WebSocket
    const protocol = auth.baseURL.startsWith('https') ? 'wss' : 'ws'
    const wsURL = auth.baseURL.replace(/^https?:\/\//, `${protocol}://`)

    const salt = String(Date.now())
    computeHash(auth.accessToken, salt).then(token => {
      const wsInstance = new WebSocket(`${wsURL}/chat-monitor/ws?token=${token}&salt=${salt}`)

      wsInstance.onopen = () => {
        wsConnected.value = true
        wsError.value = ''
        ws.value = wsInstance
      }

      wsInstance.onclose = () => {
        wsConnected.value = false
        ws.value = null
        // 自动重连
        setTimeout(() => connect(), 3000)
      }

      wsInstance.onerror = () => {
        wsError.value = 'WebSocket 连接失败，使用轮询模式'
        wsConnected.value = false
        ws.value = null
        // 降级到轮询
        startPolling()
      }

      wsInstance.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as MoonlarkStatus
          if (data.type === 'status_update' || data.type === 'pong') {
            // pong 消息不做处理
            if (data.type === 'pong') return
          }
          serverTime.value = data.server_time || ''
          mood.value = data.mood || mood.value
          sessions.value = data.sessions || sessions.value
          ego.value = data.ego || ego.value
          wsConnections.value = data.ws_connections || 0
        } catch {
          // ignore parse errors
        }
      }
    })
  }

  function disconnect() {
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    wsConnected.value = false
    stopPolling()
  }

  // Polling fallback
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    if (pollTimer) return
    pollTimer = setInterval(async () => {
      try {
        const status = await getStatus()
        serverTime.value = status.server_time || ''
        mood.value = status.mood || mood.value
        sessions.value = status.sessions || sessions.value
        ego.value = status.ego || ego.value
        wsConnections.value = status.ws_connections || 0
      } catch {
        // ignore polling errors
      }
    }, 3000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return {
    ws, wsConnected, wsError,
    serverTime, mood, sessions, ego, wsConnections,
    connect, disconnect,
  }
})
