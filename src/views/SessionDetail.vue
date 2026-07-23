<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMonitorStore } from '../stores/monitor'
import { getSessionMessages, getSessionDetail, getSessionQueue, getSessionToolCalls, getSessionMessageContext } from '../api/client'
import type { CachedMessage, SessionInfo, QueueItem } from '../types'

const route = useRoute()
const router = useRouter()
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

function goBack() {
  monitor.clearSavedSession()
  router.push('/')
}

/** 合并所有消息 + 队列事件，按时间排序 */
const combinedMessages = computed(() => {
  const list: { key: string; type: 'user' | 'self' | 'event' | 'queue'; msg?: CachedMessage; queue?: QueueItem; time: Date }[] = []

  // 已缓存的消息
  for (let i = 0; i < messages.value.length; i++) {
    const m = messages.value[i]
    const isEvent = m.self && (m.content.includes('[事件]') || m.content.startsWith('🔔'))
    const isTool = m.self && m.content.includes('[Tools]')
    const isAction = m.self && (m.content.includes('戳了戳') || m.content.includes('rua'))

    if (isEvent || isAction) {
      list.push({ key: `msg-${i}`, type: 'event', msg: m, time: m.send_time ? new Date(m.send_time) : new Date(0) })
    } else if (isTool) {
      list.push({ key: `msg-${i}`, type: 'event', msg: m, time: m.send_time ? new Date(m.send_time) : new Date(0) })
    } else if (!m.self) {
      list.push({ key: `msg-${i}`, type: 'user', msg: m, time: m.send_time ? new Date(m.send_time) : new Date(0) })
    } else {
      list.push({ key: `msg-${i}`, type: 'self', msg: m, time: m.send_time ? new Date(m.send_time) : new Date(0) })
    }
  }

  // 消息队列中待处理的事件
  for (let i = 0; i < queueItems.value.length; i++) {
    list.push({ key: `queue-${i}`, type: 'queue', queue: queueItems.value[i], time: new Date() })
  }

  // 按时间排序
  list.sort((a, b) => a.time.getTime() - b.time.getTime())
  return list
})

function formatMessage(msg: CachedMessage): string {
  return `[${msg.nickname}](${msg.message_id}): ${msg.content}`
}

async function onClickMessage(msg: CachedMessage, index: number) {
  if (msg.self) {
    modalTitle.value = `Moonlark 消息 #${index}`
    modalContent.value = '加载中...'
    showModal.value = true
    try {
      const ctx = await getSessionMessageContext(sessionId.value, index)
      modalContent.value = ctx
    } catch {
      modalContent.value = formatMessage(msg)
    }
  } else {
    modalTitle.value = `用户消息 #${index} - ${msg.nickname}`
    modalContent.value = formatMessage(msg)
    showModal.value = true
  }
}

function onClickToolCall(tc: string) {
  modalTitle.value = '工具调用详情'
  modalContent.value = tc
  showModal.value = true
}

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

// Skeleton helper
const skeletonArray = Array.from({ length: 6 }, (_, i) => i)

onMounted(() => {
  loadData()
  if (!pollTimer) {
    pollTimer = setInterval(loadData, 3000)
  }
})

onUnmounted(() => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
})
</script>

<template>
  <div class="session-detail">
    <!-- Header -->
    <div class="detail-header" v-if="sessionDetail">
      <div class="header-left">
        <a class="back-link" href="#/" @click.prevent="goBack">← 返回</a>
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
        <span class="info-item">💬{{ sessionDetail.message_count }}</span>
        <span class="info-item">🔧{{ toolCalls.length }}</span>
        <span class="info-item">📝{{ sessionDetail.accumulated_text_length }}</span>
      </div>
    </div>

    <!-- Chat area (single column) -->
    <div class="chat-area">
      <div class="message-list" v-if="!loading">
        <div
          v-for="item in combinedMessages"
          :key="item.key"
          class="msg-row"
          :class="{
            'msg-row-self': item.type === 'self',
            'msg-row-event': item.type === 'event' || item.type === 'queue',
            'msg-row-tool': item.type === 'event' && item.msg?.content?.includes('[Tools]'),
          }"
        >
          <!-- 用户消息 -->
          <div v-if="item.type === 'user' && item.msg" class="msg-bubble received" @click="onClickMessage(item.msg, messages.indexOf(item.msg))">
            <div class="msg-header">
              <span class="msg-nickname">{{ item.msg.nickname }}</span>
              <span class="msg-time">{{ item.msg.send_time ? new Date(item.msg.send_time).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '' }}</span>
            </div>
            <div class="msg-content">{{ item.msg.content }}</div>
            <div v-if="item.msg.image_count > 0" class="msg-images">
              <span class="image-badge">📷 ×{{ item.msg.image_count }}</span>
            </div>
          </div>

          <!-- Moonlark 消息 -->
          <div v-if="item.type === 'self' && item.msg" class="msg-bubble sent" @click="onClickMessage(item.msg, messages.indexOf(item.msg))">
            <div class="msg-header">
              <span class="msg-nickname">{{ item.msg.nickname }}</span>
              <span class="msg-time">{{ item.msg.send_time ? new Date(item.msg.send_time).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '' }}</span>
            </div>
            <div class="msg-content">{{ item.msg.content }}</div>
            <div v-if="item.msg.image_count > 0" class="msg-images">
              <span class="image-badge">📷 ×{{ item.msg.image_count }}</span>
            </div>
          </div>

          <!-- 事件/工具调用/动作 -->
          <div v-if="item.type === 'event' && item.msg" class="msg-bubble event-bubble">
            <span v-if="item.msg.content.includes('[Tools]')">🔧 </span>
            <span v-else-if="item.msg.content.includes('戳了戳')">👉 </span>
            <span v-else-if="item.msg.content.includes('rua')">🫳 </span>
            <span v-else>🔔 </span>
            {{ item.msg.content }}
          </div>

          <!-- 队列中的待处理事件 -->
          <div v-if="item.type === 'queue' && item.queue" class="msg-bubble queue-bubble">
            <span v-if="item.queue.type === 'message'">⏳ {{ item.queue.nickname }} 的消息等待处理</span>
            <span v-else>⏳ 事件: {{ item.queue.prompt?.slice(0, 80) }}</span>
          </div>
        </div>

        <!-- 工具调用区域 -->
        <div class="tool-calls-section" v-if="toolCalls.length > 0">
          <div class="section-label">🔧 工具调用记录</div>
          <div v-for="(tc, idx) in toolCalls" :key="'tc' + idx" class="tool-call-item" @click="onClickToolCall(tc)">
            {{ tc.slice(0, 80) }}{{ tc.length > 80 ? '...' : '' }}
          </div>
        </div>

        <div v-if="combinedMessages.length === 0 && !loading" class="empty-state">
          暂无消息
        </div>
      </div>

      <!-- 骨架屏 -->
      <div class="skeleton-list" v-else>
        <div v-for="i in skeletonArray" :key="'s' + i" class="skeleton-row" :class="i % 2 === 0 ? '' : 'skeleton-right'">
          <div class="skeleton-line skeleton-shimmer"></div>
          <div class="skeleton-line skeleton-shimmer" style="width: 70%"></div>
        </div>
      </div>

      <!-- 最近思考内容 -->
      <div v-if="sessionDetail?.last_thought" class="thought-bar">
        <span class="thought-icon">💭</span>
        <span class="thought-text">{{ sessionDetail.last_thought }}</span>
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
@media (max-width: 640px) {
  .header-right { display: none; }
  .session-title { max-width: 120px; }
}

/* ---- Chat area ---- */
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.msg-row {
  display: flex;
  justify-content: flex-start;
}
.msg-row-self {
  justify-content: flex-end;
}
.msg-row-event,
.msg-row-tool {
  justify-content: center;
}

/* Bubble styles */
.msg-bubble {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s;
  word-break: break-word;
}
.msg-bubble:hover {
  filter: brightness(1.2);
}
.msg-bubble.received {
  background: var(--bubble-other);
  border-bottom-left-radius: 4px;
}
.msg-bubble.sent {
  background: var(--bubble-self);
  border-bottom-right-radius: 4px;
}
.event-bubble {
  background: rgba(255, 255, 255, 0.04);
  max-width: 90%;
  font-size: 12px;
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: default;
}
.queue-bubble {
  background: rgba(255, 200, 0, 0.06);
  border: 1px solid rgba(255, 200, 0, 0.15);
  font-size: 12px;
  color: var(--warning);
  max-width: 90%;
  animation: pulse 1.5s infinite;
  cursor: default;
}
.msg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  gap: 8px;
}
.msg-nickname {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 600;
  white-space: nowrap;
}
.msg-time {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
}
.msg-content {
  font-size: 13px;
  line-height: 1.5;
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

/* Tool calls section */
.tool-calls-section {
  margin-top: 12px;
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

/* Thought bar */
.thought-bar {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
  max-height: 80px;
  overflow-y: auto;
}
.thought-icon {
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}
.thought-text {
  line-height: 1.5;
  white-space: pre-wrap;
}

/* Empty state */
.empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 40px 0;
  font-size: 13px;
}

/* Skeleton */
.skeleton-list {
  flex: 1;
  padding: 12px;
}
.skeleton-row {
  margin-bottom: 16px;
}
.skeleton-right {
  text-align: right;
}
.skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: var(--border);
  margin-bottom: 8px;
  display: inline-block;
}
.skeleton-shimmer {
  background: linear-gradient(90deg, var(--border) 25%, var(--bg-hover) 50%, var(--border) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
.skeleton-right .skeleton-line:first-child {
  width: 200px;
}
.skeleton-right .skeleton-line:last-child {
  width: 140px;
}
.skeleton-row:not(.skeleton-right) .skeleton-line:first-child {
  width: 180px;
}
.skeleton-row:not(.skeleton-right) .skeleton-line:last-child {
  width: 120px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Modal */
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

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
