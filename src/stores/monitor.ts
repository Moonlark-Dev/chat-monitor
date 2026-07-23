import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MoonlarkStatus, SessionInfo, MoodData, EgoState, BroadcastMessage, IncrementalUpdate } from '../types'
import { computeHash, getStatus } from '../api/client'
import { useAuthStore } from './auth'

const STORAGE_KEY_SESSION = 'chat_monitor_selected_session'
const STORAGE_KEY_NOTES_SEARCH = 'chat_monitor_notes_search'

// 指数退避参数
const BACKOFF_INITIAL = 1000     // 1 秒
const BACKOFF_MAX = 30000        // 30 秒
const BACKOFF_FACTOR = 2

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

  // Reconnection state
  let reconnectAttempts = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function _handleSnapshot(data: MoonlarkStatus) {
    serverTime.value = data.server_time || ''
    mood.value = data.mood || mood.value
    sessions.value = data.sessions || sessions.value
    ego.value = data.ego || ego.value
    wsConnections.value = data.ws_connections || 0
  }

  function _handleIncremental(data: IncrementalUpdate) {
    serverTime.value = data.server_time || ''

    // Mood (always included in incremental updates)
    if (data.mood) {
      mood.value = data.mood
    }

    // Session updates - apply immediately
    if (data.sessions_updated && data.sessions_updated.length > 0) {
      const current = sessions.value
      const idMap = new Map(current.map(s => [s.id, s]))
      for (const s of data.sessions_updated) {
        idMap.set(s.id, s)
      }
      sessions.value = Array.from(idMap.values())
    }

    // Session removals
    if (data.sessions_removed && data.sessions_removed.length > 0) {
      sessions.value = sessions.value.filter(s => !data.sessions_removed!.includes(s.id))
    }

    // EGO decision updates
    if (ego.value && data.new_ego_decisions && data.new_ego_decisions.length > 0) {
      ego.value = {
        ...ego.value,
        decision_history: [...ego.value.decision_history, ...data.new_ego_decisions],
      }
    }
    if (ego.value && data.ego_decision_full) {
      ego.value = {
        ...ego.value,
        decision_history: data.ego_decision_full,
      }
    }

    // EGO field updates
    if (ego.value && data.ego_updates) {
      ego.value = { ...ego.value, ...data.ego_updates }
    }

    // ws_connections
    if (data.ws_connections !== undefined) {
      wsConnections.value = data.ws_connections
    }
  }

  // ---- WebSocket ----

  function _scheduleReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }
    reconnectAttempts++
    const delay = Math.min(BACKOFF_INITIAL * Math.pow(BACKOFF_FACTOR, reconnectAttempts - 1), BACKOFF_MAX)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  function connect() {
    const auth = useAuthStore()
    if (!auth.isLoggedIn) return

    const protocol = auth.baseURL.startsWith('https') ? 'wss' : 'ws'
    const wsURL = auth.baseURL.replace(/^https?:\/\//, `${protocol}://`)

    const salt = String(Date.now())
    computeHash(auth.accessToken, salt).then(token => {
      // Don't leak token in URL if possible; use ws://host/chat-monitor/ws?token=***&salt=***
      const url = `${wsURL}/chat-monitor/ws?token=${token}&salt=${salt}`

      try {
        const wsInstance = new WebSocket(url)

        wsInstance.onopen = () => {
          wsConnected.value = true
          wsError.value = ''
          ws.value = wsInstance
          reconnectAttempts = 0
        }

        wsInstance.onclose = () => {
          wsConnected.value = false
          ws.value = null
          if (auth.isLoggedIn) {
            _scheduleReconnect()
          }
        }

        wsInstance.onerror = () => {
          wsError.value = 'WebSocket 连接失败，使用轮询模式'
          wsConnected.value = false
          ws.value = null
          if (auth.isLoggedIn) {
            _scheduleReconnect()
          }
          // Also start polling as fallback
          startPolling()
        }

        wsInstance.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as BroadcastMessage
            if (data.type === 'status_snapshot') {
              _handleSnapshot(data as unknown as MoonlarkStatus)
            } else if (data.type === 'incremental_update') {
              _handleIncremental(data)
            } else if (data.type === 'heartbeat') {
              serverTime.value = data.server_time || ''
            }
            // pong received, no action needed (server-side keeps connection alive)
          } catch {
            // ignore parse errors
          }
        }
      } catch (e) {
        wsError.value = `WebSocket 创建失败: ${e}`
        _scheduleReconnect()
        startPolling()
      }
    })
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    wsConnected.value = false
    stopPolling()
    reconnectAttempts = 0
  }

  // ---- Polling Fallback ----

  let pollTimer: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    // Only start polling if WebSocket is down and no active poll timer
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

  // ---- State Persistence ----

  const savedSessionId = ref(localStorage.getItem(STORAGE_KEY_SESSION) || '')
  const savedNotesSearch = ref(localStorage.getItem(STORAGE_KEY_NOTES_SEARCH) || '')

  function saveSelectedSession(id: string) {
    savedSessionId.value = id
    localStorage.setItem(STORAGE_KEY_SESSION, id)
  }

  function clearSavedSession() {
    savedSessionId.value = ''
    localStorage.removeItem(STORAGE_KEY_SESSION)
  }

  function saveNotesSearch(query: string) {
    savedNotesSearch.value = query
    localStorage.setItem(STORAGE_KEY_NOTES_SEARCH, query)
  }

  return {
    ws, wsConnected, wsError,
    serverTime, mood, sessions, ego, wsConnections,
    savedSessionId, savedNotesSearch,
    connect, disconnect,
    saveSelectedSession, clearSavedSession, saveNotesSearch,
  }
})
