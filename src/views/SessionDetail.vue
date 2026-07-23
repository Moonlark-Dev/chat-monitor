<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMonitorStore } from '../stores/monitor'
import { getSessionMessages, getSessionDetail, getSessionQueue, getSessionToolCalls } from '../api/client'
import type { CachedMessage, SessionInfo, QueueItem } from '../types'

const route = useRoute()
const monitor = useMonitorStore()

const sessionId = computed(() => decodeURIComponent(route.params.id as string))
const sessionDetail = ref<SessionInfo | null>(null)
const messages = ref<CachedMessage[]>([])
const queueItems = ref<QueueItem[]>([])
const toolCalls = ref<string[]>([])
const initialLoad = ref(true)
const loading = ref(true)

const showModal = ref(false)
const modalContent = ref('')
const modalTitle = ref('')

let pollTimer: ReturnType<typeof setInterval> | null = null

async function loadData() {
  if (initialLoad.value) loading.value = true
  try {
    const [detail, msgPage, queue, tools] = await Promise.all([
      getSessionDetail(sessionId.value),
      getSessionMessages(sessionId.value, 200),
      getSessionQueue(sessionId.value),
      getSessionToolCalls(sessionId.value),
    ])
    sessionDetail.value = detail
    messages.value = msgPage.messages
    queueItems.value = queue
    toolCalls.value = tools
  } catch (e) {
    console.error('Failed to load session:', e)
  } finally {
    loading.value = false
    initialLoad.value = false
  }
}

onMounted(() => {
  loadData()
  if (!pollTimer) {
    pollTimer = setInterval(loadData, 3000)
  }
})

onUnmounted(() => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
})

function formatMessage(msg: CachedMessage): string {
  return `[${msg.nickname}](${msg.message_id}): ${msg.content}`
}

function onClickMessage(msg: CachedMessage, index: number) {
  modalTitle.value = msg.self
    ? `Moonlark 消息 #${index}`
    : `用户消息 #${index} - ${msg.nickname}`
  modalContent.value = formatMessage(msg)
  showModal.value = true
}

function onClickToolCall(tc: string) {
  modalTitle.value = '工具调用详情'
  modalContent.value = tc
  showModal.value = true
}

// Skeleton helper
const skeletonArray = computed(() => Array.from({ length: 6 }, (_, i) => i))
</script>

<template>
  <div class="session-detail">
    <!-- Header -->
    <div class="detail-header" v-if="sessionDetail">
      <div class="header-left">
        <router-link to="/" class="back-link">← 返回</router-link>
        <h3 class="session-title">{{ sessionDetail.name || sessionId }}</h3>
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
        <span class="info-item">📊 {{ sessionDetail.message_count }} 条</span>
        <span class="info-item">🔧 {{ toolCalls.length }} 次</span>
        <span class="info-item">📝 {{ sessionDetail.accumulated_text_length }} 字</span>
      </div>
    </div>

    <!-- Status bar -->
    <div class="status-bar" v-if="sessionDetail">
      <span class="status-item">
        兴趣: <strong>{{ sessionDetail.last_interest ?? '--' }}</strong>
      </span>
      <span class="status-item">
        字数: <strong>{{ sessionDetail.accumulated_text_length ?? 0 }}</strong>
      </span>
      <span class="status-item">
        概率: <strong>{{ sessionDetail.accumulated_text_length ? (Math.min(0.95, sessionDetail.accumulated_text_length / 5000) * 100).toFixed(1) + '%' : '0%' }}</strong>
      </span>
      <span class="status-item">
        Queue: <strong>{{ sessionDetail.queue_size ?? 0 }}</strong>
      </span>
      <span class="status-item" v-if="monitor.mood">
        心情: {{ monitor.mood.emotion }}
      </span>
    </div>

    <!-- Chat area -->
    <div class="chat-area">
      <div class="chat-column left-column">
        <div class="column-header">📩 收到的消息</div>
        <div class="message-list" v-if="!loading">
          <!-- User messages -->
          <div
            v-for="(msg, idx) in messages"
            :key="'l' + idx"
            class="msg-wrapper"
          >
            <div v-if="!msg.self" class="msg-bubble received" @click="onClickMessage(msg, idx)">
              <div class="msg-header">
                <span class="msg-nickname">{{ msg.nickname }}</span>
                <span class="msg-time">{{ msg.send_time ? new Date(msg.send_time).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '' }}</span>
              </div>
              <div class="msg-content">{{ msg.content }}</div>
              <div v-if="msg.image_count > 0" class="msg-images">
                <span class="image-badge">📷 ×{{ msg.image_count }}</span>
              </div>
            </div>

            <!-- Event messages -->
            <div v-if="msg.self && (msg.content.includes('[事件]') || msg.content.startsWith('🔔'))" class="msg-event">
              <span class="event-icon">🔔</span>
              <span class="event-text">{{ msg.content }}</span>
            </div>

            <!-- Tool call records -->
            <div v-if="msg.self && msg.content.includes('[Tools]')" class="msg-tool-call" @click="onClickToolCall(msg.content)">
              <span class="tool-icon">🔧</span>
              <span class="tool-text">{{ msg.content }}</span>
            </div>
          </div>

          <!-- Queue items -->
          <div v-for="(item, idx) in queueItems" :key="'q' + idx" class="msg-queue-item">
            <span v-if="item.type === 'message'">⏳ {{ item.nickname }} 的消息等待处理</span>
            <span v-else>⏳ 事件: {{ item.prompt?.slice(0, 60) }}</span>
          </div>
        </div>
        <!-- Skeleton loading -->
        <div class="skeleton-list" v-else>
          <div v-for="i in skeletonArray" :key="i" class="skeleton-row" :style="{ width: (60 + Math.random() * 30) + '%' }">
            <div class="skeleton-line skeleton-shimmer"></div>
            <div class="skeleton-line skeleton-shimmer" style="width: 80%"></div>
          </div>
        </div>
      </div>

      <div class="chat-divider"></div>

      <div class="chat-column right-column">
        <div class="column-header">📤 Moonlark 消息</div>
        <div class="message-list" v-if="!loading">
          <div
            v-for="(msg, idx) in messages"
            :key="'r' + idx"
            class="msg-wrapper"
          >
            <!-- Sent messages -->
            <div v-if="msg.self && !msg.content.includes('[Tools]') && !msg.content.includes('[事件]') && !msg.content.startsWith('🔔')" class="msg-bubble sent" @click="onClickMessage(msg, idx)">
              <div class="msg-header">
                <span class="msg-nickname">{{ msg.nickname }}</span>
                <span class="msg-time">{{ msg.send_time ? new Date(msg.send_time).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '' }}</span>
              </div>
              <div class="msg-content">{{ msg.content }}</div>
              <div v-if="msg.image_count > 0" class="msg-images">
                <span class="image-badge">📷 ×{{ msg.image_count }}</span>
              </div>
            </div>

            <!-- Poke / Rua actions -->
            <div v-if="msg.self && (msg.content.includes('戳了戳') || msg.content.includes('rua'))" class="msg-action">
              🎯 {{ msg.content }}
            </div>
          </div>

          <!-- Tool calls section -->
          <div class="tool-calls-section" v-if="toolCalls.length > 0">
            <div class="section-label">🔧 工具调用记录</div>
            <div v-for="(tc, idx) in toolCalls" :key="'tc' + idx" class="tool-call-item" @click="onClickToolCall(tc)">
              {{ tc.slice(0, 80) }}{{ tc.length > 80 ? '...' : '' }}
            </div>
          </div>
        </div>
        <!-- Skeleton loading -->
        <div class="skeleton-list" v-else>
          <div v-for="i in skeletonArray" :key="'s' + i" class="skeleton-row" :style="{ width: (50 + Math.random() * 40) + '%', marginLeft: 'auto' }">
            <div class="skeleton-line skeleton-shimmer"></div>
            <div class="skeleton-line skeleton-shimmer" style="width: 70%"></div>
          </div>
        </div>
      </div>
    </div>

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
  min-width: 0;
}
.session-title {
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}
.back-link {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}
.back-link:hover { color: var(--accent); }
.session-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-secondary);
  white-space: nowrap;
}
.session-badge.group { background: #1a3a5a; color: #7ab8ff; }
.session-badge.private { background: #3a1a3a; color: #ff7ab8; }
.state-badge {
  font-size: 11px;
  display: flex;
  align-items: center;
  white-space: nowrap;
}
.header-right {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}
/* Mobile: hide header-right on small screens */
@media (max-width: 640px) {
  .header-right { display: none; }
  .session-title { max-width: 120px; }
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
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.status-item {
  white-space: nowrap;
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
/* Mobile: stack columns vertically */
@media (max-width: 768px) {
  .chat-area {
    flex-direction: column;
  }
  .chat-divider {
    width: 100%;
    height: 1px;
  }
  .chat-column {
    max-height: 45vh;
  }
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
.msg-images {
  margin-top: 6px;
}
.image-badge {
  font-size: 11px;
  color: var(--text-muted);
  background: rgba(0,0,0,0.3);
  padding: 2px 8px;
  border-radius: 4px;
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
.tool-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tool-call-item:hover {
  background: var(--bg-hover);
}

/* Skeleton loading */
.skeleton-list {
  flex: 1;
  padding: 12px;
}
.skeleton-row {
  margin-bottom: 16px;
}
.skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: var(--border);
  margin-bottom: 8px;
}
.skeleton-shimmer {
  background: linear-gradient(90deg, var(--border) 25%, var(--bg-hover) 50%, var(--border) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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
