// ========================================================================
// API Response Types
// ========================================================================

export interface ProbabilityDetails {
  accumulated_length: number
  base_probability: number
  ghot_coefficient: number
  ghot_applied: number
  favorability_coefficient: number
  interest_coefficient: number
  interest_value: number | null
  final_probability: number
}

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
  token_bucket?: number | null
  probability_details?: ProbabilityDetails
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
  to_me?: boolean     // 是否 @ 了 bot
  triggered_reply?: boolean  // 是否触发了 bot 回复
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
  mood_retention: number
  mood: {
    emotion: string
    intensity: number
    reason: string
  }
  blog_status: Record<string, unknown>
  plan: string
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

export interface PlanItem {
  period: string
  content: string
}

export interface EgoPlanResponse {
  items: PlanItem[]
}

export interface SessionEventsResponse {
  date: string
  summary: string
}

export interface SessionEventItem {
  id: number
  session_id: string
  content: string
  created_at: string | null
}

export interface SessionEventListResponse {
  date: string
  total: number
  events: SessionEventItem[]
}

export interface DiaryEntry {
  id: number
  content: string
  keywords: string
  created_at: string | null
  expire_at: string | null
}

export interface EgoDiariesResponse {
  total: number
  diaries: DiaryEntry[]
}

export interface BlogEntry {
  id: number
  title: string
  content: string
  created_at: string | null
}

export interface EgoBlogsResponse {
  total: number
  blogs: BlogEntry[]
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
  ego_updates?: Partial<Pick<EgoState, 'sleep_mode' | 'tiredness' | 'mood_retention'>>
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

export interface ThoughtResponse {
  thought?: string | null
  reasoning_content?: string | null
  last_response?: Record<string, unknown> | null
}

export interface OpenAIMessages {
  messages: OpenAIHistoryMessage[]
  count: number
  last_response?: Record<string, unknown> | null
}

export interface OpenAIHistoryMessage {
  role: string
  content: string | null
  tool_calls: unknown
}

// ========================================================================
// Moonlark Status (full REST response)
// ========================================================================

export interface ToolCallData {
  call_id: string
  name: string
  params: Record<string, unknown>
  result: string | null
  time: string
}

export interface MoonlarkStatus {
  server_time: string
  mood: MoodData
  ego: EgoState
  sessions: SessionInfo[]
  ws_connections: number
}
