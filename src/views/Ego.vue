<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getEgoStatus, getEgoEvents } from '../api/client'
import type { EgoState, EgoEvent } from '../types'

const egoStatus = ref<EgoState | null>(null)
const events = ref<EgoEvent[]>([])
const totalEvents = ref(0)
const eventsLoading = ref(true)

const showEventModal = ref(false)
const modalEventContent = ref('')

async function loadEgoStatus() {
  try {
    egoStatus.value = await getEgoStatus()
  } catch (e) {
    console.error('Failed to load EGO status:', e)
  }
}

async function loadEvents() {
  eventsLoading.value = true
  try {
    const result = await getEgoEvents(200)
    events.value = result.events
    totalEvents.value = result.total
  } catch (e) {
    console.error('Failed to load EGO events:', e)
  } finally {
    eventsLoading.value = false
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleString('zh-CN')
  } catch { return iso }
}

function eventType(content: string): string {
  if (content.startsWith('[动作]')) return '动作'
  if (content.startsWith('[思考]')) return '思考'
  if (content.startsWith('[动作结果]')) return '结果'
  if (content.startsWith('[QQ中的事件]')) return 'QQ事件'
  return '其他'
}

function eventBadge(type: string): string {
  const colors: Record<string, string> = {
    '动作': '#e94560',
    '思考': '#f39c12',
    '结果': '#2ecc71',
    'QQ事件': '#3498db',
    '其他': '#95a5a6',
  }
  return colors[type] || '#95a5a6'
}

function onClickEvent(event: EgoEvent) {
  modalEventContent.value = event.content
  showEventModal.value = true
}

const emotionState = (status: EgoState | null) => {
  if (!status) return { text: '', color: 'var(--text-muted)' }
  const moodColors: Record<string, string> = {
    joy: '#2ecc71', sadness: '#3498db', anger: '#e74c3c',
    fear: '#9b59b6', surprise: '#f39c12', calm: '#1abc9c',
    bored: '#95a5a6', confused: '#e67e22', tired: '#7f8c8d',
  }
  const mood = status.mood?.emotion || 'calm'
  return {
    text: mood,
    color: moodColors[mood] || 'var(--text-muted)',
  }
}

onMounted(() => {
  loadEgoStatus()
  loadEvents()
})

// Refresh periodically
onMounted(() => {
  setInterval(loadEgoStatus, 5000)
})
</script>

<template>
  <div class="ego-page">
    <!-- EGO Status -->
    <div class="ego-status card" v-if="egoStatus">
      <h2>🧠 EGO 状态</h2>
      <div class="status-grid">
        <div class="status-item">
          <span class="label">状态</span>
          <span class="value" :style="{ color: emotionState(egoStatus).color }">
            {{ emotionState(egoStatus).text.toUpperCase() }}
          </span>
        </div>
        <div class="status-item">
          <span class="label">心情强度</span>
          <span class="value">{{ (egoStatus.mood_retention * 100).toFixed(0) }}%</span>
        </div>
        <div class="status-item">
          <span class="label">睡眠模式</span>
          <span class="value" :class="egoStatus.sleep_mode ? 'sleeping' : 'awake'">
            {{ egoStatus.sleep_mode ? '💤 睡眠中' : '✨ 清醒' }}
          </span>
        </div>
        <div class="status-item">
          <span class="label">困倦度</span>
          <span class="value">{{ (egoStatus.tiredness * 100).toFixed(0) }}%</span>
        </div>
        <div class="status-item" v-if="egoStatus.sleep_begin_time">
          <span class="label">入睡时间</span>
          <span class="value">{{ formatTime(egoStatus.sleep_begin_time) }}</span>
        </div>
        <div class="status-item">
          <span class="label">当前活动</span>
          <span class="value">{{ egoStatus.current_activity || '无' }}</span>
        </div>
        <div class="status-item" v-if="egoStatus.activity_start_time">
          <span class="label">活动开始</span>
          <span class="value">{{ formatTime(egoStatus.activity_start_time) }}</span>
        </div>
        <div class="status-item">
          <span class="label">今日计划</span>
          <span class="value plan-text">{{ egoStatus.plan || '暂无计划' }}</span>
        </div>
      </div>
    </div>

    <!-- Events Timeline -->
    <div class="ego-section">
      <h3>📜 事件记录 ({{ totalEvents }})</h3>
      <div v-if="eventsLoading" class="loading-state">加载中...</div>
      <div v-else class="event-list">
        <div
          v-for="event in events"
          :key="event.id"
          class="event-item"
          @click="onClickEvent(event)"
        >
          <div class="event-time">{{ formatTime(event.created_at) }}</div>
          <div class="event-type" :style="{ background: eventBadge(eventType(event.content)) + '22', color: eventBadge(eventType(event.content)) }">
            {{ eventType(event.content) }}
          </div>
          <div class="event-content">{{ event.content.slice(0, 120) }}{{ event.content.length > 120 ? '...' : '' }}</div>
        </div>
        <div v-if="events.length === 0" class="empty-state">暂无事件记录</div>
      </div>
    </div>

    <!-- Event Modal -->
    <div v-if="showEventModal" class="overlay" @click.self="showEventModal = false">
      <div class="modal">
        <h3>事件详情</h3>
        <pre class="modal-body">{{ modalEventContent }}</pre>
        <div class="modal-actions">
          <button class="btn btn-secondary btn-sm" @click="showEventModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ego-page {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ego-status {
  padding: 20px;
}
.ego-status h2 {
  font-size: 18px;
  margin-bottom: 16px;
}
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.status-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.status-item .label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.status-item .value {
  font-size: 16px;
  font-weight: 600;
}
.status-item .value.sleeping { color: #9b59b6; }
.status-item .value.awake { color: var(--success); }
.status-item .value.plan-text {
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
}

.ego-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
}
.ego-section h3 {
  font-size: 15px;
  margin-bottom: 12px;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 500px;
  overflow-y: auto;
}
@media (max-width: 768px) {
  .event-list {
    max-height: 300px;
  }
}
.event-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}
.event-item:hover {
  background: var(--bg-hover);
}
.event-time {
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 140px;
  font-size: 11px;
}
.event-type {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
.event-content {
  flex: 1;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.loading-state, .empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 30px 0;
  font-size: 13px;
}

/* Modal */
.modal-body {
  background: var(--bg-primary);
  padding: 12px;
  border-radius: var(--radius);
  font-size: 12px;
  max-height: 60vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  }
</style>
