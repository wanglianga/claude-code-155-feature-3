<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import { EXTENSION_POLICY } from '../../types'
import { weekdayCn } from '../../utils/date'

const auth = useAuthStore()
const data = useDataStore()
const mid = auth.current!.id
const myName = auth.current!.name

const upcoming = computed(() => data.upcomingSessions(mid).filter(s => !s.isExperience))
const myLeaves = computed(() => data.leaves.filter(l => {
  const s = data.sessions.find(x => x.id === l.sessionId)
  return s?.memberId === mid
}))
const pkg = computed(() => data.activePackage(mid))

const tab = ref<'leave' | 'reschedule' | 'pain' | 'coach' | 'complaint'>('leave')

const leaveForm = reactive({ sessionId: '', reason: '' })
const reForm = reactive({ sessionId: '', date: '', time: '19:00-20:00' })
const painText = ref('')
const coachReason = ref('')
const complaintText = ref('')
const msg = ref('')

function flash(t: string) {
  msg.value = t
  setTimeout(() => (msg.value = ''), 2500)
}

function submitLeave() {
  if (!leaveForm.sessionId || !leaveForm.reason) { alert('请选择课程并填写原因'); return }
  data.requestLeave(leaveForm.sessionId, 'member', mid, leaveForm.reason)
  const lv = data.leaves[0]
  flash(lv?.withinRule ? '请假申请已提交，等待顾问确认' : '已提交，但超出请假规则（次数/提前时长），请与顾问确认')
  leaveForm.reason = ''
}

function submitReschedule() {
  if (!reForm.sessionId || !reForm.date) { alert('请选择课程与新日期'); return }
  data.rescheduleSession(reForm.sessionId, reForm.date, reForm.time, 'member', myName)
  flash('改期已生效并通知顾问与教练')
}

function submitPain() {
  if (!painText.value.trim()) { alert('请描述不适情况'); return }
  data.reportDiscomfort(mid, painText.value, myName)
  painText.value = ''
  flash('已上报，教练会据此调整训练计划')
}

function submitCoachChange() {
  if (!coachReason.value.trim()) { alert('请填写换教练原因'); return }
  data.requestCoachChange(mid, coachReason.value, myName)
  coachReason.value = ''
  flash('申请已提交，顾问会与你沟通；你的全部训练记录将完整交接给新教练')
}

function submitComplaint() {
  if (!complaintText.value.trim()) { alert('请填写投诉内容'); return }
  data.addComplaint(mid, complaintText.value, myName)
  complaintText.value = ''
  flash('投诉已提交')
}

const tabs = [
  { key: 'leave', label: '请假' },
  { key: 'reschedule', label: '临时改期' },
  { key: 'pain', label: '身体不适上报' },
  { key: 'coach', label: '申请换教练' },
  { key: 'complaint', label: '投诉建议' },
] as const
</script>

<template>
  <div class="page">
    <h2 class="page-title">请假与申请</h2>
    <p class="page-sub">每一次请假、改期与不适都会写入训练记录，成为后续排课依据。</p>

    <div v-if="msg" class="banner warn">{{ msg }}</div>

    <div class="checks mb8">
      <label v-for="t in tabs" :key="t.key" :class="{ on: tab === t.key }">
        <input type="radio" :value="t.key" v-model="tab" />{{ t.label }}
      </label>
    </div>

    <!-- 请假 -->
    <div v-if="tab === 'leave'" class="card">
      <h3>请假</h3>
      <p v-if="pkg" class="muted">请假规则：{{ pkg.leaveRule.note }}</p>
      <div v-if="pkg && pkg.extensionCount > 0" class="banner warn">
        ⚠️ 本课包已延期 <b>{{ pkg.extensionCount }}/{{ EXTENSION_POLICY.maxTimes }}</b> 次（累计 {{ pkg.extensionDaysTotal }}/{{ EXTENSION_POLICY.maxTotalDays }} 天）。
        {{ EXTENSION_POLICY.note }}
        继续请假可能导致剩余课程在到期前无法排完，建议优先到馆上课或与顾问确认安排。
      </div>
      <div class="form-row">
        <label>选择课程</label>
        <select v-model="leaveForm.sessionId">
          <option value="" disabled>请选择</option>
          <option v-for="s in upcoming" :key="s.id" :value="s.id">
            {{ s.date }}（{{ weekdayCn(s.date) }}）{{ s.time }} · {{ data.coachById(s.coachId)?.name }}
          </option>
        </select>
      </div>
      <div class="form-row"><label>请假原因</label><textarea v-model="leaveForm.reason" placeholder="如：临时出差"></textarea></div>
      <button :disabled="!upcoming.length" @click="submitLeave">提交请假</button>

      <h3 class="mt16">请假记录</h3>
      <table v-if="myLeaves.length" class="plain">
        <thead><tr><th>课程</th><th>原因</th><th>状态</th><th>符合规则</th></tr></thead>
        <tbody>
          <tr v-for="l in myLeaves" :key="l.id">
            <td>{{ data.sessions.find(s => s.id === l.sessionId)?.date }}</td>
            <td>{{ l.reason }}</td>
            <td><span class="tag" :class="l.status === '待处理' ? 'amber' : l.status === '已批准' ? '' : 'gray'">{{ l.status }}</span></td>
            <td>{{ l.withinRule ? '是' : '否（需顾问确认）' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">暂无请假记录</div>
    </div>

    <!-- 改期 -->
    <div v-if="tab === 'reschedule'" class="card">
      <h3>临时改期</h3>
      <div class="form-row">
        <label>选择课程</label>
        <select v-model="reForm.sessionId">
          <option value="" disabled>请选择</option>
          <option v-for="s in upcoming" :key="s.id" :value="s.id">
            {{ s.date }}（{{ weekdayCn(s.date) }}）{{ s.time }} · {{ data.coachById(s.coachId)?.name }}
          </option>
        </select>
      </div>
      <div class="grid cols-2">
        <div class="form-row"><label>新日期</label><input v-model="reForm.date" type="date" /></div>
        <div class="form-row">
          <label>新时间</label>
          <select v-model="reForm.time">
            <option>10:00-11:00</option><option>14:00-15:00</option><option>19:00-20:00</option><option>20:00-21:00</option>
          </select>
        </div>
      </div>
      <button :disabled="!upcoming.length" @click="submitReschedule">确认改期</button>
    </div>

    <!-- 不适上报 -->
    <div v-if="tab === 'pain'" class="card">
      <h3>身体不适上报</h3>
      <p class="muted">不适信息会同时通知教练与顾问：教练据此调整训练计划，顾问跟进排课安排。</p>
      <div class="form-row">
        <label>不适描述</label>
        <textarea v-model="painText" placeholder="如：昨天课后右膝外侧疼痛加重，上下楼明显，约 5/10 分"></textarea>
      </div>
      <button class="warn" @click="submitPain">上报不适</button>
    </div>

    <!-- 换教练 -->
    <div v-if="tab === 'coach'" class="card">
      <h3>申请换教练</h3>
      <p class="muted">你的测评档案、全部课后记录与疼痛趋势会完整交接给新教练，不需要从零开始沟通。</p>
      <div class="form-row">
        <label>申请原因</label>
        <textarea v-model="coachReason" placeholder="如：希望更换为女教练 / 沟通风格不适应"></textarea>
      </div>
      <button @click="submitCoachChange">提交申请</button>
    </div>

    <!-- 投诉 -->
    <div v-if="tab === 'complaint'" class="card">
      <h3>投诉建议</h3>
      <div class="form-row">
        <label>内容</label>
        <textarea v-model="complaintText" placeholder="告诉我们哪里做得不好"></textarea>
      </div>
      <button @click="submitComplaint">提交</button>
    </div>
  </div>
</template>
