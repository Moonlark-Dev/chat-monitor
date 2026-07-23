<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMonitorStore } from '../stores/monitor'

const props = defineProps<{
  onLogout: () => void
}>()

const monitor = useMonitorStore()
const router = useRouter()

const currentRoute = computed(() => router.currentRoute.value.path)

const navItems = [
  { path: '/', label: '会话', icon: '💬' },
  { path: '/notes', label: '笔记', icon: '📝' },
  { path: '/ego', label: 'EGO', icon: '🧠' },
]

function formatServerTime(iso: string): string {
  if (!iso) return '--'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

function moodEmoji(emotion: string): string {
  const map: Record<string, string> = {
    joy: '😊', sadness: '😢', anger: '😠', fear: '😨',
    surprise: '😮', disgust: '🤢', trust: '🤝', anticipation: '🤔',
    calm: '😌', bored: '😑', confused: '😕', tired: '😴', shy: '😳',
  }
  return map[emotion] || '😐'
}
</script>

<template>
  <nav class="navbar">
    <div class="nav-left">
      <span class="nav-brand">📡 Chat Monitor</span>
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-link"
        :class="{ active: currentRoute === item.path || (item.path === '/' && currentRoute.startsWith('/session/')) }"
      >
        {{ item.icon }} {{ item.label }}
      </router-link>
    </div>
    <div class="nav-right">
      <span class="nav-info" :title="monitor.mood.reason">
        {{ moodEmoji(monitor.mood.emotion) }} {{ monitor.mood.emotion }}
      </span>
      <span class="nav-info">
        🕐 {{ formatServerTime(monitor.serverTime) }}
      </span>
      <span class="nav-info conn-status" :class="{ connected: monitor.wsConnected }">
        <span class="status-dot" :class="monitor.wsConnected ? 'online' : 'offline'"></span>
        {{ monitor.wsConnected ? '已连接' : '未连接' }}
      </span>
      <button class="btn btn-sm btn-secondary logout-btn" @click="onLogout">退出</button>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  height: var(--navbar-height);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  z-index: 100;
}
.nav-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nav-brand {
  font-weight: 700;
  font-size: 15px;
  color: var(--accent);
  margin-right: 16px;
  white-space: nowrap;
}
.nav-link {
  padding: 6px 14px;
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.2s;
  white-space: nowrap;
}
.nav-link:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.nav-link.active {
  background: var(--accent);
  color: white;
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.nav-info {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.conn-status .status-dot {
  margin-right: 4px;
}
.logout-btn {
  font-size: 12px;
}
</style>
