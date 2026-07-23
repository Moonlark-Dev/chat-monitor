<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useMonitorStore } from './stores/monitor'
import NavBar from './components/NavBar.vue'

const auth = useAuthStore()
const monitor = useMonitorStore()
const router = useRouter()

const showLayout = computed(() => auth.isLoggedIn)

onMounted(() => {
  if (auth.isLoggedIn) {
    monitor.connect()
  }
})

onUnmounted(() => {
  monitor.disconnect()
})

function handleLogout() {
  monitor.disconnect()
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-layout" v-if="showLayout">
    <NavBar @logout="handleLogout" />
    <main class="app-main">
      <router-view />
    </main>
  </div>
  <div v-else>
    <router-view />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.app-main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
