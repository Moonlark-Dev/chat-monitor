<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMonitorStore } from '../stores/monitor'
import { getSessionMessages, getSessionDetail, getSessionQueue, getSessionToolCalls, getSessionOpenAIMessages, getEgoStatus } from '../api/client'
import type { CachedMessage, SessionInfo, QueueItem, OpenAIHistoryMessage } from '../types'

const route = useRoute()
const monitor = useMonitorStore()

const sessionId = computed(() => decodeURIComponent(route.params.id as string))
const sessionDetail = ref<SessionInfo | null>(null)
const messages = ref<CachedMessage[]>([])
const queueItems = ref<QueueItem[]>([])
const toolCalls = ref<string[]>([])
const openaiMsgs = ref<OpenAIHistoryMessage[]>([])
const loading = ref(true)

const egoStatus = ref<any>(null)

const showModal = ref(false)
const modalContent = ref('')
const modalTitle = ref('')

let pollTimer: ReturnType<typeof setInterval> | null = null

async function loadData() {
  loading.value = true
  try {
    const [detail, msgPage, queue, tools, oaiMsgs] = await Promise.all([
      getSessionDetail(sessionId.value),
      getSessionMessages(sessionId.value, 200),
      getSessionQueue(sessionId.value),
      getSessionToolCalls(sessionId.value),
      getSessionOpenAIMessages(sessionId.value),
    ])
    sessionDetail.value = detail
    messages.value = msgPage.messages
    queueItems.value = queue
    toolCalls.value = tools
    openaiMsgs.value = oaiMsgs.messages
  } catch (e) {
    console.error('Failed to load session:', e)
  } finally {
    loading.value = false
  }
}

async function loadEgoStatus() {
  try {
    egoStatus.value = await getEgoStatus()
  } catch { /* ignore */ }
}

onMounted(() => {
  loadData()
  loadEgoStatus()
  if (!pollTimer) {
    pollTimer = setInterval(() => {
      loadData()
      loadEgoStatus()
    }, 3000)
  }
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})

function onClickMessage(msg: CachedMessage, index: number) {
  if (msg.self) {
    const oaiMsgsVal = openaiMsgs.value
    const assistantMsg = oaiMsgsVal.find((m: OpenAIHistoryMessage) => m.role === 'assistant')
    if (assistantMsg) {
      modalTitle.value = `Moonlark 回复 #${index}`
      modalContent.value = JSON.stringify(assistantMsg, null, 2)
    } else {
      modalTitle.value = `Moonlark 消息 #${index}`
      modalContent.value = msg.content
    }
    showModal.value = true
  } else {
    modalTitle.value = `用户消息 #${index} - ${msg.nickname}`
    modalContent.value = msg.content
    showModal.value = true
  }
}

function onClickToolCall(tc: string) {
  modalTitle.value = '工具调用详情'
  modalContent.value = tc
  showModal.value = true
}
</script>

<template>
  <div class="session-detail">
    <!-- Header -->
    <div class="detail-header" v-if="sessionDetail">
      <div class="header-left">
        <router-link to="/" class="back-link">← 返回</router-link>
        <h3>{{ sessionDetail.name || sessionId }}</h3>
        <span class="session-badge" :class="sessionDetail.type">
          {{ sessionDetail.type === 'group' ? '群聊' : '私聊' }}
        </span>
        <span class="state-badge">
          <span class="status-dot" :class="sessionDetail.state"></span>
          {{
            sessionDetail.state === 'parsing' ? '解析中' :
            sessionDetail.state === 'replying' ? '回复中' : 'IDLE'
          }}
        </span>
      </div>
      <div class="header-right">
        <span class="info-item">📊 {{ sessionDetail.message_count }} 条消息</span>
        <span class="info-item">🔧 {{ toolCalls.length }} 次工具调用</span>
        <span class="info-item">📝 {{ sessionDetail.accumulated_text_length }} 字</span>
      </div>
    </div>

    <!-- Status bar -->
    <div class="status-bar" v-if="egoStatus">
      <span class="status-item">
        兴趣: <strong>{{ sessionDetail?.last_interest ?? egoStatus?.mood?.intensity ?? '--' }}</strong>
      </span>
      <span class="status-item">
        累积字数: <strong>{{ sessionDetail?.accumulated_text_length ?? 0 }}</strong>
      </span>
      <span class="status-item">
        触发概率: <strong>{{ sessionDetail?.accumulated_text_length ? (Math.min(0.95, sessionDetail.accumulated_text_length / 5000) * 100).toFixed(1) + '%' : '0%' }}</strong>
      </span>
      <span class="status-item" v-if="monitor.mood">
        心情: {{ monitor.mood.emotion }} ({{ (monitor.mood.intensity * 100).toFixed(0) }}%)
      </span>
    </div>

    <!-- Chat area -->
    <div class="chat-area" v-if="!loading">
      <div class="chat-column left-column">
        <div class="column-header">📩 收到的消息</div>
        <div class="message-list">
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="msg-wrapper"
            :class="{ 'msg-self': msg.self }"
          >
            <!-- User message bubble -->
            <div v-if="!msg.self" class="msg-bubble received" @click="onClickMessage(msg, idx)">
              <div class="msg-header">
                <span class="msg-nickname">{{ msg.nickname }}</span>
                <span class="msg-time">{{ msg.send_time ? new Date(msg.send_time).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '' }}</span>
              </div>
              <div class="msg-content">{{ msg.content }}</div>
            </div>

            <!-- Event-style messages -->
            <div v-if="msg.self && (msg.content.includes('[事件]') || msg.content.startsWith('🔔'))" class="msg-event">
              <span class="event-icon">🔔</span>
              <span class="event-text">{{ msg.content }}</span>
            </div>

            <!-- Tool calls -->
            <div v-if="msg.self && msg.content.includes('[Tools]')" class="msg-tool-call" @click="onClickToolCall(msg.content)">
              <span class="tool-icon">🔧</span>
              <span class="tool-text">{{ msg.content }}</span>
            </div>
          </div>

          <!-- Queue items -->
          <div v-for="(item, idx) in queueItems" :key="'q'+idx" class="msg-queue-item">
            <span v-if="item.type === 'message'">⏳ {{ item.nickname }} 的消息等待处理</span>
            <span v-else>⏳ 事件: {{ item.prompt?.slice(0, 60) }}</span>
          </div>
        </div>
      </div>

      <div class="chat-divider"></div>

      <div class="chat-column right-column">
        <div class="column-header">📤 Moonlark 消息</div>
        <div class="message-list">
          <div
            v-for="(msg, idx) in messages"
            :key="'r'+idx"
            class="msg-wrapper msg-wrapper-right"
          >
            <!-- Moonlark sent messages -->
            <div v-if="msg.self && !msg.content.includes('[Tools]') && !msg.content.includes('[事件]') && !msg.content.startsWith('🔔')" class="msg-bubble sent" @click="onClickMessage(msg, idx)">
              <div class="msg-header">
                <span class="msg-nickname">{{ msg.nickname }}</span>
                <span class="msg-time">{{ msg.send_time ? new Date(msg.send_time).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '' }}</span>
              </div>
              <div class="msg-content">{{ msg.content }}</div>
            </div>

            <!-- Poke / Rua actions -->
            <div v-if="msg.self && (msg.content.includes('戳了戳') || msg.content.includes('rua'))" class="msg-action">
              🎯 {{ msg.content }}
            </div>
          </div>

          <!-- Tool calls section -->
          <div class="tool-calls-section" v-if="toolCalls.length > 0">
            <div class="section-label">🔧 工具调用记录</div>
            <div v-for="(tc, idx) in toolCalls" :key="'tc'+idx" class="tool-call-item" @click="onClickToolCall(tc)">
              {{ tc }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">加载中...</div>

    <!-- Modal -->
    <div v-if="showModal" class="overlay" @click.self="showModal = false">
      <div class="modal">
        <h3>{{ modalTitle }}</h3>
        <pre class="modal-body">{{ modalContent }}</pre>
        <div class="modal-actions">
          <button class="btn btn-secondary btn-sm" @click="showModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.header-left h3 {
  font-size: 15px;
}
.back-link {
  font-size: 13px;
  color: var(--text-secondary);
}
.back-link:hover { color: var(--accent); }
.session-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-secondary);
}
.session-badge.group { background: #1a3a5a; color: #7ab8ff; }
.session-badge.private { background: #3a1a3a; color: #ff7ab8; }
.state-badge {
  font-size: 11px;
  display: flex;
  align-items: center;
}
.header-right {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}
.status-bar {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  font-size: 12px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.status-item strong {
  color: var(--text-primary);
}
.chat-area {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.chat-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.column-header {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.chat-divider {
  width: 1px;
  background: var(--border);
  flex-shrink: 0;
}

.msg-wrapper {
  margin-bottom: 8px;
}
.msg-bubble {
  padding: 8px 12px;
  border-radius: var(--radius);
  max-width: 90%;
  cursor: pointer;
  transition: all 0.15s;
}
.msg-bubble:hover {
  filter: brightness(1.2);
}
.msg-bubble.received {
  background: var(--bubble-other);
  margin-right: auto;
}
.msg-bubble.sent {
  background: var(--bubble-self);
  margin-left: auto;
}
.msg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.msg-nickname {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 600;
}
.msg-time {
  font-size: 10px;
  color: var(--text-muted);
}
.msg-content {
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}

.msg-event {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bubble-event);
  border-radius: var(--radius);
  margin: 4px 0;
}
.event-icon { font-size: 14px; }

.msg-tool-call {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--warning);
  background: #1a1a0a;
  border-radius: var(--radius);
  margin: 4px 0;
  cursor: pointer;
}
.tool-icon { font-size: 14px; }

.msg-queue-item {
  padding: 4px 8px;
  font-size: 12px;
  color: var(--warning);
  animation: pulse 1.5s infinite;
  margin: 2px 0;
}

.msg-action {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 8px;
  text-align: center;
}

.tool-calls-section {
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}
.section-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.tool-call-item {
  font-size: 11px;
  color: var(--warning);
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 2px;
  font-family: monospace;
}
.tool-call-item:hover {
  background: var(--bg-hover);
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-muted);
}

.modal-body {
  background: var(--bg-primary);
  padding: 12px;
  border-radius: var(--radius);
  font-size: 12px;
  max-height: 50vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}
</style>
