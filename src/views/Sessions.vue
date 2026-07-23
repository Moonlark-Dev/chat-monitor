<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMonitorStore } from '../stores/monitor'
import type { SessionInfo } from '../types'

const monitor = useMonitorStore()
const router = useRouter()

const sessionList = computed(() => monitor.sessions)

function sessionLabel(s: SessionInfo): string {
  if (s.type === 'group') return '👥'
  if (s.type === 'private') return '👤'
  return '❓'
}

function stateLabel(state: string): string {
  const map: Record<string, string> = {
    parsing: '解析中',
    replying: '回复中',
    idle: 'IDLE',
  }
  return map[state] || state
}

function lastActivity(iso: string | null): string {
  if (!iso) return '--'
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    return d.toLocaleDateString('zh-CN')
  } catch {
    return iso
  }
}

function goToSession(id: string) {
  router.push(`/session/${encodeURIComponent(id)}`)
}
</script>

<template>
  <div class="sessions-page">
    <div class="page-header">
      <h2>会话 ({{ sessionList.length }})</h2>
    </div>
    <div class="sessions-list">
      <div
        v-for="s in sessionList"
        :key="s.id"
        class="session-card card"
        @click="goToSession(s.id)"
      >
        <div class="session-avatar">{{ sessionLabel(s) }}</div>
        <div class="session-info">
          <div class="session-name">{{ s.name || s.id }}</div>
          <div class="session-id">{{ s.id }}</div>
          <div class="session-meta">
            <span class="session-state">
              <span class="status-dot" :class="s.state"></span>
              {{ stateLabel(s.state) }}
            </span>
            <span class="session-time">最后活动: {{ lastActivity(s.last_activity) }}</span>
          </div>
        </div>
        <div class="session-stats">
          <span class="stat" title="消息数">💬 {{ s.message_count }}</span>
        </div>
      </div>
      <div v-if="sessionList.length === 0" class="empty-state">
        暂无活跃会话
      </div>
    </div>
  </div>
</template>

<style scoped>
.sessions-page {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}
.page-header {
  margin-bottom: 16px;
}
.page-header h2 {
  font-size: 18px;
}
.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.session-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s;
}
.session-card:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
}
.session-avatar {
  font-size: 28px;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border-radius: 50%;
}
.session-info {
  flex: 1;
  min-width: 0;
}
.session-name {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.session-id {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}
.session-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}
.session-state {
  display: flex;
  align-items: center;
}
.session-stats {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 60px 0;
  font-size: 14px;
}
</style>
