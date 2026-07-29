<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getEgoStatus, getEgoPlan, getEgoSessionEventList, getEgoDiaries, getEgoBlogs } from '../api/client'
import type { EgoState, PlanItem, SessionEventItem, DiaryEntry, BlogEntry } from '../types'

const egoStatus = ref<EgoState | null>(null)
const planItems = ref<PlanItem[]>([])
const sessionEvents = ref<SessionEventItem[]>([])
const totalSessionEvents = ref(0)
const diaries = ref<DiaryEntry[]>([])
const totalDiaries = ref(0)
const blogs = ref<BlogEntry[]>([])
const totalBlogs = ref(0)

const loading = ref(true)
const showEventModal = ref(false)
const modalEventContent = ref('')

async function loadAll() {
  loading.value = true
  try {
    const [status, plan, sessRes, diariesRes, blogsRes] = await Promise.allSettled([
      getEgoStatus(),
      getEgoPlan(),
      getEgoSessionEventList(100),
      getEgoDiaries(10),
      getEgoBlogs(10),
    ])

    if (status.status === 'fulfilled') egoStatus.value = status.value
    if (plan.status === 'fulfilled') planItems.value = plan.value.items
    if (sessRes.status === 'fulfilled') {
      sessionEvents.value = sessRes.value.events
      totalSessionEvents.value = sessRes.value.total
    }
    if (diariesRes.status === 'fulfilled') {
      diaries.value = diariesRes.value.diaries
      totalDiaries.value = diariesRes.value.total
    }
    if (blogsRes.status === 'fulfilled') {
      blogs.value = blogsRes.value.blogs
      totalBlogs.value = blogsRes.value.total
    }
  } finally {
    loading.value = false
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleString('zh-CN')
  } catch { return iso }
}

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  try {
    const d = new Date(iso)
    const now = new Date()
    const today = now.toDateString() === d.toDateString()
    if (today) return `今天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
    if (yesterday.toDateString() === d.toDateString()) return `昨天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function onClickEvent(event: { content: string }) {
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
  loadAll()
  setInterval(loadAll, 10000)
})
</script>

<template>
  <div class="ego-page">
    <!-- 状态卡片 -->
    <div class="card ego-status" v-if="egoStatus">
      <h2>🧠 EGO 状态</h2>
      <div class="status-grid">
        <div class="status-item">
          <span class="label">心情</span>
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
          <span class="label">博客冷却</span>
          <span class="value" v-if="(egoStatus.blog_status as any)?.cooldown_remaining">
            {{ Math.ceil((egoStatus.blog_status as any).cooldown_remaining / 60) }} 分钟
          </span>
          <span class="value" v-else>就绪</span>
        </div>
      </div>
    </div>

    <!-- 今日计划 -->
    <div class="ego-section" v-if="planItems.length > 0">
      <h3>📅 今日计划</h3>
      <div class="plan-items">
        <div v-for="(item, idx) in planItems" :key="idx" class="plan-item">
          <span class="plan-period">{{ item.period }}</span>
          <span class="plan-content">{{ item.content }}</span>
        </div>
      </div>
    </div>

    <!-- 群聊事件记录 -->
    <div class="ego-section" v-if="sessionEvents.length > 0">
      <h3>💬 群聊事件记录 ({{ totalSessionEvents }})</h3>
      <div class="sess-event-list">
        <div v-for="evt in sessionEvents" :key="evt.id" class="sess-event-item" @click="onClickEvent(evt)">
          <div class="sess-event-time">{{ formatTime(evt.created_at) }}</div>
          <div class="sess-event-session">{{ evt.session_id.slice(0, 16) }}</div>
          <div class="sess-event-content">{{ evt.content.slice(0, 200) }}{{ evt.content.length > 200 ? '...' : '' }}</div>
        </div>
      </div>
    </div>

    <!-- 日记记录 -->
    <div class="ego-section">
      <h3>📓 日记记录 ({{ totalDiaries }})</h3>
      <div v-if="loading && diaries.length === 0" class="loading-state">加载中...</div>
      <div v-else-if="diaries.length === 0" class="empty-state">暂无日记记录</div>
      <div v-else class="diary-list">
        <div v-for="diary in diaries" :key="diary.id" class="diary-item" @click="onClickEvent(diary)">
          <div class="diary-header">
            <span class="diary-time">{{ formatDate(diary.created_at) }}</span>
            <span class="diary-keywords" v-if="diary.keywords">{{ diary.keywords }}</span>
          </div>
          <div class="diary-content">{{ diary.content.slice(0, 200) }}{{ diary.content.length > 200 ? '...' : '' }}</div>
        </div>
      </div>
    </div>

    <!-- 博客记录 -->
    <div class="ego-section">
      <h3>📝 博客记录 ({{ totalBlogs }})</h3>
      <div v-if="loading && blogs.length === 0" class="loading-state">加载中...</div>
      <div v-else-if="blogs.length === 0" class="empty-state">暂无博客记录</div>
      <div v-else class="blog-list">
        <div v-for="blog in blogs" :key="blog.id" class="blog-item" @click="onClickEvent(blog)">
          <div class="blog-header">
            <span class="blog-title">{{ blog.title }}</span>
            <span class="blog-time">{{ formatDate(blog.created_at) }}</span>
          </div>
          <div class="blog-content">{{ blog.content.slice(0, 150) }}{{ blog.content.length > 150 ? '...' : '' }}</div>
        </div>
      </div>
    </div>



    <!-- 详情 Modal -->
    <div v-if="showEventModal" class="overlay" @click.self="showEventModal = false">
      <div class="modal">
        <h3>详情</h3>
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
  gap: 12px;
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
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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
  font-size: 15px;
  font-weight: 600;
}
.status-item .value.sleeping { color: #9b59b6; }
.status-item .value.awake { color: var(--success); }

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

/* 计划 */
.plan-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.plan-item {
  display: flex;
  gap: 12px;
  padding: 8px;
  background: var(--bg-primary);
  border-radius: var(--radius);
  font-size: 13px;
}
.plan-period {
  color: var(--accent);
  font-weight: 600;
  white-space: nowrap;
  min-width: 60px;
}
.plan-content {
  color: var(--text-secondary);
}

/* 群聊事件 */
.sess-event-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 400px;
  overflow-y: auto;
}
.sess-event-item {
  display: flex;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}
.sess-event-item:hover {
  background: var(--bg-hover);
}
.sess-event-time {
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 140px;
  font-size: 11px;
}
.sess-event-session {
  color: var(--accent);
  font-weight: 600;
  white-space: nowrap;
  min-width: 60px;
  font-size: 11px;
}
.sess-event-content {
  flex: 1;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 日记 */
.diary-list, .blog-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 400px;
  overflow-y: auto;
}
.diary-item, .blog-item {
  padding: 10px;
  background: var(--bg-primary);
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.15s;
}
.diary-item:hover, .blog-item:hover {
  background: var(--bg-hover);
}
.diary-header, .blog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.diary-time, .blog-time {
  font-size: 11px;
  color: var(--text-muted);
}
.diary-keywords {
  font-size: 11px;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  padding: 1px 6px;
  border-radius: 4px;
}
.diary-content, .blog-content {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.blog-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 旧事件 */
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
