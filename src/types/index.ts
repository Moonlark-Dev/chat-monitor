// ========================================================================
// API Response Types
// ========================================================================

export interface SessionInfo {
  id: string
  type: 'group' | 'private' | 'unknown'
  name: string
  state: 'parsing' | 'replying' | 'idle'
  last_activity: string | null
  message_count: number
  tool_calls_count?: number
  ghot_coefficient?: number
  accumulated_text_length?: number
  last_interest?: number | null
  queue_size?: number
  last_thought?: string | null
}

export interface CachedMessage {
  content: string
  nickname: string
  user_id: string
  platform_user_id: string
  send_time: string | null
  self: boolean
  message_id: string
  image_count: number
  images?: string[]  // base64 encoded images (only when requested)
}

export interface MessagePage {
  total: number
  messages: CachedMessage[]
}

export interface QueueItem {
  type: 'message' | 'event'
  user_id?: string
  nickname?: string
  time?: string
  prompt?: string
  trigger_mode?: string
}

export interface MoodData {
  emotion: string
  intensity: number
  reason: string
}

export interface EgoState {
  sleep_mode: boolean
  tiredness: number
  sleep_begin_time: string | null
  current_activity: string | null
  activity_start_time: string | null
  decision_history: DecisionHistoryItem[]
  last_decision_time: string | null
  mood_retention: number
  mood: {
    emotion: string
    intensity: number
    reason: string
  }
  blog_status: Record<string, unknown>
  proactive_info: Record<string, unknown>
}

export interface DecisionHistoryItem {
  time: string
  action: string
}

export interface EgoEvent {
  id: number
  created_at: string | null
  content: string
}

export interface EgoEventsPage {
  total: number
  events: EgoEvent[]
}

export interface Note {
  id: number
  context_id: string
  content: string
  keywords: string
  created_time: number
  expire_time: string | null
}

export interface NotesPage {
  total: number
  notes: Note[]
}

// ========================================================================
// WebSocket Message Types
// ========================================================================

/** 全量快照（首次连接 + 每 30 秒） */
export interface StatusSnapshot {
  type: 'status_snapshot'
  server_time: string
  mood: MoodData
  ego: EgoState
  sessions: SessionInfo[]
  ws_connections: number
}

/** 增量更新（常规推送） */
export interface IncrementalUpdate {
  type: 'incremental_update'
  server_time: string
  mood?: MoodData
  sessions_updated?: SessionInfo[]
  sessions_removed?: string[]
  new_ego_decisions?: DecisionHistoryItem[]
  ego_decision_full?: DecisionHistoryItem[]
  ego_updates?: Partial<Pick<EgoState, 'sleep_mode' | 'tiredness' | 'current_activity' | 'mood_retention'>>
  ws_connections?: number
}

/** 心跳（无变化时的轻量推送） */
export interface Heartbeat {
  type: 'heartbeat'
  server_time: string
}

export type BroadcastMessage = StatusSnapshot | IncrementalUpdate | Heartbeat

// ========================================================================
// OpenAI Messages
// ========================================================================

export interface OpenAIMessages {
  messages: OpenAIHistoryMessage[]
  count: number
}

export interface OpenAIHistoryMessage {
  role: string
  content: string | null
  tool_calls: unknown
}

// ========================================================================
// Moonlark Status (full REST response)
// ========================================================================

export interface MoonlarkStatus {
  server_time: string
  mood: MoodData
  ego: EgoState
  sessions: SessionInfo[]
  ws_connections: number
}
