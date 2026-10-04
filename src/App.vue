<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useDataStore } from './stores/data'

const auth = useAuthStore()
const data = useDataStore()
const router = useRouter()

const navs = computed(() => {
  if (auth.role === 'member') {
    return [
      { to: '/member', label: '我的主页' },
      { to: '/member/book', label: '预约体验课' },
      { to: '/member/records', label: '训练记录' },
      { to: '/member/requests', label: '请假与申请' },
    ]
  }
  if (auth.role === 'coach') {
    return [{ to: '/coach', label: '本周课表' }]
  }
  if (auth.role === 'consultant') {
    return [
      { to: '/consultant', label: '经营看板' },
      { to: '/consultant/arrange', label: '安排体验课' },
      { to: '/consultant/tickets', label: '异常工单' },
    ]
  }
  if (auth.role === 'manager') {
    return [{ to: '/manager', label: '延期审批' }]
  }
  return []
})

const roleName = computed(() => ({ member: '会员', coach: '教练', consultant: '顾问', manager: '店长' } as Record<string, string>)[auth.role ?? ''] ?? '')

function logout() {
  auth.logout()
  router.replace('/login')
}

function resetDemo() {
  if (confirm('将清空当前所有操作并恢复演示数据，确定吗？')) {
    data.resetDemo()
    location.reload()
  }
}
</script>

<template>
  <div>
    <header v-if="auth.isLoggedIn" class="topbar">
      <div class="brand">🧘 澄心瑜伽 · 私教管理</div>
      <nav>
        <router-link v-for="n in navs" :key="n.to" :to="n.to" class="nav-link" active-class="on">{{ n.label }}</router-link>
      </nav>
      <div class="me">
        <span class="tag">{{ roleName }}</span>
        <span>{{ auth.current?.name }}</span>
        <button class="small ghost" @click="resetDemo">重置演示数据</button>
        <button class="small ghost" @click="logout">退出</button>
      </div>
    </header>
    <router-view />
  </div>
</template>

<style scoped>
.topbar {
  display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
  padding: 10px 20px; background: #fff; border-bottom: 1px solid var(--line);
  position: sticky; top: 0; z-index: 10;
}
.brand { font-weight: 700; color: var(--sage-deep); }
nav { display: flex; gap: 4px; flex: 1; flex-wrap: wrap; }
.nav-link { padding: 6px 12px; border-radius: 8px; color: var(--ink); font-size: 14px; }
.nav-link.on { background: var(--sage-soft); color: var(--sage-deep); font-weight: 600; }
.me { display: flex; align-items: center; gap: 8px; font-size: 14px; }
</style>
