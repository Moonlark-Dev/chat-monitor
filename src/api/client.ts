import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import type { SessionInfo, MessagePage, QueueItem, NotesPage, Note, EgoState, EgoEventsPage, MoonlarkStatus, OpenAIMessages } from '../types'

// 使用 Web Crypto API 计算 SHA-256
export async function computeHash(password: string, salt: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password + '+' + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
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

export async function getSessionToolCalls(id: string): Promise<string[]> {
  return get<string[]>(`/chat-monitor/sessions/${encodeURIComponent(id)}/tool-calls`)
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
