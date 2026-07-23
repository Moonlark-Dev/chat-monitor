<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const backendUrl = ref('')
const accessToken = ref('')
const error = ref('')

function handleLogin() {
  error.value = ''
  if (!backendUrl.value.trim()) {
    error.value = '请输入后端地址'
    return
  }
  if (!accessToken.value.trim()) {
    error.value = '请输入 Access Token'
    return
  }
  try {
    new URL(backendUrl.value)
  } catch {
    error.value = '后端地址格式不正确'
    return
  }

  auth.login(backendUrl.value.replace(/\/+$/, ''), accessToken.value)
  router.push('/')
}
</script>

<template>
  <div class="login-page">
    <div class="login-card card">
      <h1 class="login-title">📡 Chat Monitor</h1>
      <p class="login-desc">连接 Moonlark 后端，实时查看聊天和 EGO 状态</p>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>后端地址</label>
          <input
            v-model="backendUrl"
            type="url"
            placeholder="例如 http://192.168.1.100:8080"
            autocomplete="url"
          />
        </div>
        <div class="form-group">
          <label>Access Token</label>
          <input
            v-model="accessToken"
            type="password"
            placeholder="输入 .env 中的 status_report_password"
          />
        </div>

        <p v-if="error" class="login-error">{{ error }}</p>

        <button type="submit" class="btn btn-primary login-btn">连接</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
}
.login-card {
  width: 400px;
  padding: 32px;
}
.login-title {
  font-size: 24px;
  text-align: center;
  margin-bottom: 8px;
  color: var(--accent);
}
.login-desc {
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 24px;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group label {
  font-size: 13px;
  color: var(--text-secondary);
}
.login-error {
  color: var(--danger);
  font-size: 13px;
  text-align: center;
}
.login-btn {
  width: 100%;
  justify-content: center;
  padding: 12px;
}
</style>
