<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useDataStore } from '../stores/data'
import type { Role } from '../types'

const auth = useAuthStore()
const data = useDataStore()
const router = useRouter()

const picked = ref('')
const password = ref('123456')
const error = ref('')

const groups = computed(() => {
  const g: Record<Role, typeof data.accounts> = { member: [], coach: [], consultant: [], manager: [] }
  data.accounts.forEach(a => g[a.role].push(a))
  return g
})

const roleLabel: Record<Role, string> = { member: '会员', coach: '教练', consultant: '顾问', manager: '店长' }
const roleDesc: Record<Role, string> = {
  member: '预约体验课 / 查看课表课包 / 请假改期 / 不适上报',
  coach: '周课表 / 体验测评 / 课后记录 / 课程调整',
  consultant: '转化看板 / 安排体验课 / 异常工单 / 续费沟通与延期申请',
  manager: '延期申请审批 / 合同规则把关',
}

function login() {
  const acc = data.accounts.find(a => a.id === picked.value)
  if (!acc) { error.value = '请选择账号'; return }
  if (acc.password !== password.value) { error.value = '密码错误（演示账号密码均为 123456）'; return }
  auth.login(acc)
  router.replace(acc.role === 'member' ? '/member' : acc.role === 'coach' ? '/coach' : acc.role === 'manager' ? '/manager' : '/consultant')
}
</script>

<template>
  <div class="login-wrap">
    <div class="login-card card">
      <h2 style="margin: 0 0 4px">🧘 澄心瑜伽 · 私教全流程管理</h2>
      <p class="muted">体验课测评 · 排课 · 训练记录 · 续费与转教练 —— 三个角色，同一套训练记录</p>

      <div v-for="r in (['consultant', 'manager', 'coach', 'member'] as Role[])" :key="r" class="mb8">
        <div class="row mb8">
          <b>{{ roleLabel[r] }}</b>
          <span class="muted">{{ roleDesc[r] }}</span>
        </div>
        <div class="checks">
          <label v-for="a in groups[r]" :key="a.id" :class="{ on: picked === a.id }">
            <input type="radio" :value="a.id" v-model="picked" />
            {{ a.name }}
            <span v-if="a.role === 'coach'" class="muted">
              {{ data.coachById(a.id)?.specialties.join('/') }}
            </span>
          </label>
        </div>
      </div>

      <div class="form-row mt16">
        <label>密码（演示账号统一为 123456）</label>
        <input v-model="password" type="password" @keyup.enter="login" />
      </div>
      <div v-if="error" class="banner danger">{{ error }}</div>
      <button style="width: 100%" @click="login">登 录</button>
    </div>
  </div>
</template>

<style scoped>
.login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
.login-card { width: 640px; max-width: 100%; }
</style>
