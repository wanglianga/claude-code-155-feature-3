<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import type { ExtensionRequest } from '../../types'
import { EXTENSION_POLICY } from '../../types'
import { addDays, WEEKDAY_CN } from '../../utils/date'

const auth = useAuthStore()
const data = useDataStore()
const myName = auth.current!.name

const pending = computed(() => data.pendingExtensions)
const decided = computed(() =>
  data.extensions.filter(e => e.status !== '待审批').sort((a, b) => b.decidedAt.localeCompare(a.decidedAt)),
)

const notes = reactive<Record<string, string>>({})

function pkgOf(e: ExtensionRequest) {
  return data.packages.find(p => p.id === e.packageId)
}

function slotsLabel(e: ExtensionRequest) {
  if (!e.newSlots.length) return '沿用原频率'
  return e.newSlots.map(s => `每周${WEEKDAY_CN[s.weekday].slice(1)} ${s.time}`).join('、')
}

function decide(e: ExtensionRequest, approve: boolean) {
  data.decideExtension(e.id, approve, notes[e.id]?.trim() ?? '', myName)
}
</script>

<template>
  <div class="page">
    <h2 class="page-title">延期审批 · {{ myName }}</h2>
    <p class="page-sub">{{ EXTENSION_POLICY.note }} 审批通过后系统自动重排课包日历，并把承诺写入课包记录。</p>

    <div v-if="!pending.length" class="card"><div class="empty">暂无待审批的延期申请 🎉</div></div>

    <div v-for="e in pending" :key="e.id" class="card">
      <div class="between">
        <h3 style="margin: 0">
          <span class="tag amber">待审批</span>
          {{ data.nameOf(e.memberId) }} · {{ e.extendDays > 0 ? `延期 ${e.extendDays} 天` : '调整上课频率' }}
        </h3>
        <span class="muted">{{ e.createdAt }} · 顾问 {{ e.consultantName }}</span>
      </div>

      <dl class="kv mt8">
        <dt>课包</dt>
        <dd>{{ pkgOf(e)?.name }}（已上 {{ pkgOf(e)?.usedSessions }}/{{ pkgOf(e)?.totalSessions }} 节）</dd>
        <dt>申请原因</dt>
        <dd>{{ e.reason }}</dd>
        <dt>当前有效期</dt>
        <dd>
          {{ pkgOf(e)?.expiryDate }}
          <template v-if="e.extendDays > 0 && pkgOf(e)"> → 通过后 <b>{{ addDays(pkgOf(e)!.expiryDate, e.extendDays) }}</b></template>
        </dd>
        <dt>新上课频率</dt>
        <dd>{{ slotsLabel(e) }}</dd>
        <dt>合同规则校验</dt>
        <dd>
          已延期 {{ pkgOf(e)?.extensionCount }}/{{ EXTENSION_POLICY.maxTimes }} 次、
          累计 {{ pkgOf(e)?.extensionDaysTotal }}/{{ EXTENSION_POLICY.maxTotalDays }} 天
          <template v-if="pkgOf(e) && e.extendDays > 0">
            → 通过后 {{ pkgOf(e)!.extensionCount + 1 }}/{{ EXTENSION_POLICY.maxTimes }} 次、
            累计 {{ pkgOf(e)!.extensionDaysTotal + e.extendDays }}/{{ EXTENSION_POLICY.maxTotalDays }} 天
          </template>
          <span v-if="pkgOf(e) && e.extendDays > 0 && (pkgOf(e)!.extensionCount + 1 > EXTENSION_POLICY.maxTimes || pkgOf(e)!.extensionDaysTotal + e.extendDays > EXTENSION_POLICY.maxTotalDays)" class="tag danger">超出合同规则，应拒绝</span>
          <span v-else class="tag">符合合同规则</span>
        </dd>
      </dl>

      <div class="row mt8">
        <input v-model="notes[e.id]" placeholder="审批意见（写入训练记录与课包承诺）" style="flex: 1" />
        <button class="small" @click="decide(e, true)">批准并重排日历</button>
        <button class="small danger" @click="decide(e, false)">拒绝</button>
      </div>
    </div>

    <div v-if="decided.length" class="card">
      <h3>已审批</h3>
      <div v-for="e in decided" :key="e.id" class="mb8" style="border-bottom: 1px solid var(--line); padding-bottom: 8px">
        <div>
          <span class="tag" :class="e.status === '已通过' ? '' : 'danger'">{{ e.status }}</span>
          <b>{{ data.nameOf(e.memberId) }}</b> · {{ e.extendDays > 0 ? `延期 ${e.extendDays} 天` : '调整频率' }}
          <span class="muted"> · {{ e.decidedBy }} · {{ e.decidedAt }}</span>
        </div>
        <div class="muted">原因：{{ e.reason }}<span v-if="e.decideNote">；审批意见：{{ e.decideNote }}</span></div>
      </div>
    </div>
  </div>
</template>
