import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import type { SessionInfo, MessagePage, QueueItem, NotesPage, Note, EgoState, EgoEventsPage, EgoPlanResponse, SessionEventsResponse, SessionEventListResponse, EgoDiariesResponse, EgoBlogsResponse, MoonlarkStatus, OpenAIMessages, ToolCallData } from '../types'

// 使用 Web Crypto API 计算 SHA-256，降级到纯 JS 实现
async function sha256Subtle(data: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle!.digest('SHA-256', data as any)
  return new Uint8Array(buf)
}

function sha256JS(data: Uint8Array): Uint8Array {
  // 精简版 SHA-256 实现（用于 crypto.subtle 不可用时的降级）
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ])
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])

  // Pad message
  const ml = data.length * 8
  const paddedLen = (((data.length + 9 + 63) >>> 6) << 6) // 512-bit blocks
  const padded = new Uint8Array(paddedLen)
  padded.set(data)
  padded[data.length] = 0x80
  new DataView(padded.buffer).setUint32(paddedLen - 4, ml, false)

  for (let i = 0; i < paddedLen; i += 64) {
    const W = new Uint32Array(64)
    for (let t = 0; t < 16; t++)
      W[t] = new DataView(padded.buffer).getUint32(i + t * 4, false)
    for (let t = 16; t < 64; t++) {
      const s0 = ((W[t - 15] >>> 7) | (W[t - 15] << 25)) ^ ((W[t - 15] >>> 18) | (W[t - 15] << 14)) ^ (W[t - 15] >>> 3)
      const s1 = ((W[t - 2] >>> 17) | (W[t - 2] << 15)) ^ ((W[t - 2] >>> 19) | (W[t - 2] << 13)) ^ (W[t - 2] >>> 10)
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0
    }

    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7]
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch = (e & f) ^ ((~e) & g)
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0
      ;[h, g, f, e, d, c, b, a] = [g, f, e, (d + temp1) >>> 0, c, b, a, (temp1 + temp2) >>> 0]
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0
  }

  const out = new Uint8Array(32)
  for (let i = 0; i < 8; i++) {
    out[i * 4] = H[i] >>> 24
    out[i * 4 + 1] = H[i] >>> 16
    out[i * 4 + 2] = H[i] >>> 8
    out[i * 4 + 3] = H[i]
  }
  return out
}

export async function computeHash(password: string, salt: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password + '+' + salt)
  let hashBuffer: Uint8Array
  if (typeof crypto !== 'undefined' && typeof crypto.subtle?.digest === 'function') {
    hashBuffer = await sha256Subtle(msgBuffer)
  } else {
    hashBuffer = sha256JS(msgBuffer)
  }
  const hashArray = Array.from(hashBuffer)
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function authParams(): Promise<{ token: string; salt: string }> {
  const auth = useAuthStore()
  const salt = String(Date.now())
  const token = await computeHash(auth.accessToken, salt)
  return { token, salt }
}

async function get<T>(path: string, extraParams: Record<string, unknown> = {}): Promise<T> {
  const auth = useAuthStore()
  const params = await authParams()
  const { data } = await axios.get(`${auth.baseURL}${path}`, {
    params: { ...params, ...extraParams },
  })
  return data
}

async function post<T>(path: string, body: Record<string, unknown>, extraParams: Record<string, unknown> = {}): Promise<T> {
  const auth = useAuthStore()
  const params = await authParams()
  const { data } = await axios.post(`${auth.baseURL}${path}`, body, {
    params: { ...params, ...extraParams },
  })
  return data
}

async function put<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const auth = useAuthStore()
  const params = await authParams()
  const { data } = await axios.put(`${auth.baseURL}${path}`, body, {
    params: { ...params },
  })
  return data
}

async function del(path: string): Promise<void> {
  const auth = useAuthStore()
  const params = await authParams()
  await axios.delete(`${auth.baseURL}${path}`, { params: { ...params } })
}

export async function getStatus(): Promise<MoonlarkStatus> {
  return get<MoonlarkStatus>('/chat-monitor/status')
}

export async function getSessions(): Promise<SessionInfo[]> {
  return get<SessionInfo[]>('/chat-monitor/sessions')
}

export async function getSessionDetail(id: string): Promise<SessionInfo> {
  return get<SessionInfo>(`/chat-monitor/sessions/${encodeURIComponent(id)}`)
}

export async function getSessionMessages(id: string, limit = 100, offset = 0): Promise<MessagePage> {
  return get<MessagePage>(`/chat-monitor/sessions/${encodeURIComponent(id)}/messages`, { limit, offset })
}

export async function getSessionQueue(id: string): Promise<QueueItem[]> {
  return get<QueueItem[]>(`/chat-monitor/sessions/${encodeURIComponent(id)}/queue`)
}

export async function getSessionToolCalls(id: string): Promise<ToolCallData[]> {
  return get<ToolCallData[]>(`/chat-monitor/sessions/${encodeURIComponent(id)}/tool-calls`)
}

export async function getSessionMessageContext(id: string, msgIndex: number): Promise<string> {
  const r = await get<{ context: string }>(`/chat-monitor/sessions/${encodeURIComponent(id)}/messages/${msgIndex}/context`)
  return r.context
}

export async function getSessionOpenAIMessages(id: string): Promise<OpenAIMessages> {
  return get<OpenAIMessages>(`/chat-monitor/sessions/${encodeURIComponent(id)}/openai-messages`)
}

export async function getNotes(search = '', limit = 200, offset = 0): Promise<NotesPage> {
  return get<NotesPage>('/chat-monitor/notes', { search, limit, offset })
}

export async function createNote(content: string, keywords = '', contextId = 'chat-monitor', expireHours?: number): Promise<Note> {
  return post<Note>('/chat-monitor/notes', {
    context_id: contextId, content, keywords, expire_hours: expireHours,
  })
}

export async function updateNote(noteId: number, body: Record<string, unknown>): Promise<Note> {
  return put<Note>(`/chat-monitor/notes/${noteId}`, body)
}

export async function deleteNote(noteId: number): Promise<void> {
  return del(`/chat-monitor/notes/${noteId}`)
}

export async function getEgoStatus(): Promise<EgoState> {
  return get<EgoState>('/chat-monitor/ego/status')
}

export async function getEgoEvents(limit = 100, offset = 0): Promise<EgoEventsPage> {
  return get<EgoEventsPage>('/chat-monitor/ego/events', { limit, offset })
}

export async function getEgoPlan(): Promise<EgoPlanResponse> {
  return get<EgoPlanResponse>('/chat-monitor/ego/plan')
}

export async function getEgoSessionEvents(date = ''): Promise<SessionEventsResponse> {
  return get<SessionEventsResponse>('/chat-monitor/ego/session-events', date ? { date } : undefined)
}

export async function getEgoSessionEventList(limit = 50, offset = 0, date = ''): Promise<SessionEventListResponse> {
  return get<SessionEventListResponse>('/chat-monitor/ego/session-event-list', { limit, offset, ...(date ? { date } : {}) })
}

export async function getEgoDiaries(limit = 10, offset = 0): Promise<EgoDiariesResponse> {
  return get<EgoDiariesResponse>('/chat-monitor/ego/diaries', { limit, offset })
}

export async function getEgoBlogs(limit = 10, offset = 0): Promise<EgoBlogsResponse> {
  return get<EgoBlogsResponse>('/chat-monitor/ego/blogs', { limit, offset })
}
