<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'

const auth = useAuthStore()
const data = useDataStore()
const myName = auth.current!.name

const funnel = computed(() => data.funnel)
const alerts = computed(() => data.renewalAlerts)
const tickets = computed(() => data.openTickets)
const leaves = computed(() => data.pendingLeaves)
const complaints = computed(() => data.openComplaints)

const behindMembers = computed(() =>
  data.packages
    .filter(p => p.status === '进行中' && data.progressOf(p).behind)
    .map(p => ({ pkg: p, prog: data.progressOf(p) }))
)

function sessionLabel(sessionId: string) {
  const s = data.sessions.find(x => x.id === sessionId)
  return s ? `${s.date} ${s.time}（${data.nameOf(s.memberId)}）` : ''
}

function decideLeave(id: string, ok: boolean) {
  data.decideLeave(id, ok, myName)
}
</script>

<template>
  <div class="page">
    <h2 class="page-title">经营看板 · {{ myName }}</h2>
    <p class="page-sub">体验转化、续费进度、请假与投诉 —— 销售动作全部基于教练留下的真实训练记录。</p>

    <!-- 转化漏斗 -->
    <div class="grid cols-4">
      <div class="card stat"><div class="num">{{ funnel.待安排 }}</div><div class="lbl">体验待安排</div></div>
      <div class="card stat"><div class="num">{{ funnel.已安排 }}</div><div class="lbl">体验已安排</div></div>
      <div class="card stat"><div class="num">{{ funnel.已完成测评 }}</div><div class="lbl">已测评待购课</div></div>
      <div class="card stat"><div class="num">{{ funnel.已购课 }}</div><div class="lbl">已购课转化</div></div>
    </div>

    <div class="grid cols-2">
      <!-- 续费进度 -->
      <div class="card">
        <h3>续费提醒（剩余 ≤4 节或 ≤21 天到期）</h3>
        <table v-if="alerts.length" class="plain">
          <thead><tr><th>会员</th><th>课包</th><th>剩余</th><th>到期</th><th>延期</th><th></th></tr></thead>
          <tbody>
            <tr v-for="a in alerts" :key="a.pkg.id">
              <td><b>{{ data.nameOf(a.pkg.memberId) }}</b></td>
              <td>{{ a.pkg.name }}</td>
              <td>{{ a.remaining }} 节</td>
              <td>{{ a.daysLeft }} 天</td>
              <td><span class="tag" :class="a.pkg.extensionCount >= 2 ? 'danger' : a.pkg.extensionCount > 0 ? 'amber' : 'gray'">{{ a.pkg.extensionCount }}/2 次</span></td>
              <td><router-link :to="`/consultant/renewal/${a.pkg.memberId}`"><button class="small">续费沟通</button></router-link></td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">暂无续费提醒</div>
      </div>

      <!-- 进度落后 -->
      <div class="card">
        <h3>课消进度落后</h3>
        <table v-if="behindMembers.length" class="plain">
          <thead><tr><th>会员</th><th>已上/应上</th><th>剩余天数</th><th></th></tr></thead>
          <tbody>
            <tr v-for="b in behindMembers" :key="b.pkg.id">
              <td><b>{{ data.nameOf(b.pkg.memberId) }}</b></td>
              <td>{{ b.pkg.usedSessions }} / {{ b.prog.expected }} 节</td>
              <td>{{ b.prog.daysLeft }} 天</td>
              <td><router-link :to="`/consultant/member/${b.pkg.memberId}`"><button class="small ghost">查看</button></router-link></td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">暂无进度落后</div>
      </div>
    </div>

    <div class="grid cols-2">
      <!-- 请假审批 -->
      <div class="card">
        <h3>待处理请假</h3>
        <div v-for="l in leaves" :key="l.id" class="between mb8" style="border-bottom: 1px solid var(--line); padding-bottom: 8px">
          <div>
            <span class="tag" :class="l.byRole === 'coach' ? 'clay' : 'amber'">{{ l.byRole === 'coach' ? '教练请假' : '会员请假' }}</span>
            <b>{{ data.nameOf(l.byId) }}</b> · {{ sessionLabel(l.sessionId) }}
            <div class="muted">{{ l.reason }}<span v-if="!l.withinRule" class="tag danger">超出请假规则</span></div>
          </div>
          <div class="row">
            <button class="small" @click="decideLeave(l.id, true)">批准</button>
            <button class="small ghost" @click="decideLeave(l.id, false)">拒绝</button>
          </div>
        </div>
        <div v-if="!leaves.length" class="empty">暂无待处理请假</div>
      </div>

      <!-- 投诉 -->
      <div class="card">
        <h3>投诉</h3>
        <div v-for="c in complaints" :key="c.id" class="mb8" style="border-bottom: 1px solid var(--line); padding-bottom: 8px">
          <div><b>{{ data.nameOf(c.memberId) }}</b> <span class="tag danger">{{ c.status }}</span></div>
          <div style="font-size: 14px">{{ c.content }}</div>
          <div v-if="c.reply" class="muted">回复：{{ c.reply }}</div>
          <div class="mt8">
            <router-link :to="`/consultant/member/${c.memberId}`"><button class="small ghost">去处理</button></router-link>
          </div>
        </div>
        <div v-if="!complaints.length" class="empty">暂无投诉</div>
      </div>
    </div>

    <!-- 异常工单 -->
    <div class="card">
      <div class="between">
        <h3 style="margin: 0">进行中的异常工单（{{ tickets.length }}）</h3>
        <router-link to="/consultant/tickets"><button class="small ghost">全部工单 →</button></router-link>
      </div>
      <table v-if="tickets.length" class="plain mt8">
        <thead><tr><th>类型</th><th>会员</th><th>事项</th><th>状态</th><th>创建时间</th></tr></thead>
        <tbody>
          <tr v-for="t in tickets.slice(0, 5)" :key="t.id">
            <td><span class="tag" :class="t.type === '会员不适' ? 'danger' : t.type === '课包到期' ? 'amber' : 'clay'">{{ t.type }}</span></td>
            <td>{{ data.nameOf(t.memberId) }}</td>
            <td>{{ t.title }}</td>
            <td>{{ t.status }}</td>
            <td class="muted">{{ t.createdAt }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">暂无异常工单</div>
    </div>
  </div>
</template>
