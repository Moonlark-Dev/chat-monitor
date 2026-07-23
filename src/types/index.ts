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

export interface MoonlarkStatus {
  type: string
  server_time: string
  mood: MoodData
  ego: EgoState
  sessions: SessionInfo[]
  ws_connections: number
}

export interface OpenAIMessages {
  messages: OpenAIHistoryMessage[]
  count: number
}

export interface OpenAIHistoryMessage {
  role: string
  content: string | null
  tool_calls: unknown
}
