<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import TrainingTimeline from '../../components/TrainingTimeline.vue'
import ProfessionalProfile from '../../components/ProfessionalProfile.vue'
import PackageCard from '../../components/PackageCard.vue'
import { slotsText, weekdayCn } from '../../utils/date'
import type { ExtensionRequest, WeekSlot } from '../../types'

const route = useRoute()
const auth = useAuthStore()
const data = useDataStore()
const mid = route.params.id as string
const myName = auth.current!.name

const member = computed(() => data.accountById(mid))
const pkg = computed(() => data.activePackage(mid))
const records = computed(() => data.recordsOf(mid))
const trend = computed(() => data.painTrend(mid))
const attendance = computed(() => data.attendanceOf(mid))
const renewals = computed(() => data.renewals.filter(r => r.memberId === mid))
const complaints = computed(() => data.complaints.filter(c => c.memberId === mid && c.status !== '已关闭'))
const brief = computed(() => data.renewalBrief(mid))
const extInfo = computed(() => pkg.value ? data.extensionInfo(pkg.value) : null)
const pkgRequests = computed(() =>
  pkg.value ? data.extensionRequests.filter(r => r.packageId === pkg.value!.id) : []
)
const currentSlots = computed<WeekSlot[]>(() => pkg.value ? data.slotsOf(pkg.value.id) : [])

const follow = reactive({ summary: '', result: '跟进中' as '跟进中' | '已续费' | '暂缓' })
const renewSpec = reactive({ name: '私教 24 节 · 进阶周期', totalSessions: 24, validDays: 120, weekday: 2, time: '19:00-20:00' })
const complaintReply = reactive<Record<string, string>>({})
const msg = ref('')

// ---------------- 延期 / 调频率 ----------------
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const
const TIMES = ['10:00-11:00', '14:00-15:00', '19:00-20:00', '20:00-21:00']

const extForm = reactive({
  kind: '延期' as ExtensionRequest['kind'],
  extendDays: 7,
  weekdays: new Set<number>(),
  time: '19:00-20:00',
  reason: '',
})

function resetExtForm() {
  extForm.kind = '延期'
  extForm.extendDays = 7
  extForm.weekdays = new Set(currentSlots.value.map(s => s.weekday))
  extForm.time = currentSlots.value[0]?.time ?? '19:00-20:00'
  extForm.reason = ''
}
// 课包切换/首次进入时用当前频率预填
resetExtForm()
// 会员 360° 在不同会员间切换（同一路由组件复用）时重新预填
watch(() => pkg.value?.id, () => resetExtForm())

const changesFreq = computed(() => extForm.kind === '调整频率' || extForm.kind === '延期并调整频率')
const extendsExpiry = computed(() => extForm.kind !== '调整频率')
const newSlots = computed<WeekSlot[]>(() =>
  changesFreq.value
    ? [...extForm.weekdays].sort((a, b) => a - b).map(w => ({ weekday: w, time: extForm.time }))
    : currentSlots.value
)

const preview = computed(() => {
  if (!pkg.value) return null
  const days = extendsExpiry.value ? extForm.extendDays : 0
  return data.extensionPreview(pkg.value.id, days, newSlots.value)
})

function toggleWeekday(w: number) {
  if (extForm.weekdays.has(w)) extForm.weekdays.delete(w)
  else extForm.weekdays.add(w)
  // Set 是引用类型，主动替换以触发响应式
  extForm.weekdays = new Set(extForm.weekdays)
}

function submitExtension() {
  if (!pkg.value) return
  const res = data.applyExtension(
    {
      packageId: pkg.value.id, kind: extForm.kind,
      extendDays: extForm.extendDays, newSlots: newSlots.value,
      reason: extForm.reason,
    },
    auth.current!.id, myName,
  )
  if (!res.ok) { alert(res.error); return }
  resetExtForm()
  alert(res.warning
    ? `申请已提交，等待审批。\n⚠️ 排期提示：${res.warning}`
    : '申请已提交，等待审批；审批通过后课包日历将自动重排。')
}

const rejectText = reactive<Record<string, string>>({})
function approve(r: ExtensionRequest) {
  if (!confirm('确认审批通过？通过后课包有效期/频率立即变更，剩余待上课自动重排，承诺写入课包记录。')) return
  data.decideExtension(r.id, true, '店长审批')
}
function reject(r: ExtensionRequest) {
  const reason = rejectText[r.id]?.trim()
  if (!reason) { alert('请填写驳回原因（将写入会员记录）'); return }
  data.decideExtension(r.id, false, '店长审批', reason)
  rejectText[r.id] = ''
}

/** 基于真实训练数据生成续费沟通要点（出勤/请假/训练效果/教练建议） */
function draftSummary() {
  const parts: string[] = []
  if (brief.value) {
    const b = brief.value
    parts.push(`课包剩余 ${b.schedule.remaining} 节、${b.schedule.daysLeft} 天到期`)
    parts.push(`出勤：完成 ${b.attendance.done} 节、请假 ${b.attendance.leave} 次${b.attendance.rate != null ? `（出勤率 ${b.attendance.rate}%）` : ''}`)
    if (b.effects.pain.length) parts.push(`训练效果：${b.effects.pain.join('；')}`)
    if (b.effects.feelAvg != null) parts.push(`平均体感 ${b.effects.feelAvg}/10`)
    if (b.coachAdvice.note) parts.push(`教练建议：${b.coachAdvice.note}`)
    if (b.schedule.gap > 0) parts.push(`按当前「${b.schedule.slots}」频率到期前只能再上 ${b.schedule.canFinish} 节，${b.schedule.gap} 节无法完成，需续费、延期或调频率`)
  }
  follow.summary = `基于训练记录沟通：${parts.join('；')}。`
}

function submitFollow() {
  if (!follow.summary.trim()) { alert('请填写沟通纪要'); return }
  data.followUpRenewal(
    mid, auth.current!.id, follow.summary, follow.result, myName,
    follow.result === '已续费'
      ? { name: renewSpec.name, totalSessions: renewSpec.totalSessions, validDays: renewSpec.validDays, slots: [{ weekday: renewSpec.weekday, time: renewSpec.time }] }
      : undefined,
  )
  follow.summary = ''
  msg.value = follow.result === '已续费' ? '已生成新课包并与原课包衔接' : '跟进记录已保存'
  setTimeout(() => (msg.value = ''), 2500)
}

function reply(cId: string) {
  const r = complaintReply[cId]?.trim()
  if (!r) { alert('请填写回复'); return }
  data.replyComplaint(cId, r, myName)
}
</script>

<template>
  <div class="page" v-if="member">
    <h2 class="page-title">{{ member.name }} · 会员 360°</h2>
    <p class="page-sub">顾问视角：续费与跟进全部基于教练留下的真实训练进度；教练的专业档案只读，不可改写为销售话术。</p>

    <div v-if="msg" class="banner warn">{{ msg }}</div>

    <div class="grid cols-4">
      <div class="card stat"><div class="num">{{ attendance.done }}</div><div class="lbl">已完成课程</div></div>
      <div class="card stat"><div class="num">{{ attendance.leave }}</div><div class="lbl">请假次数</div></div>
      <div class="card stat"><div class="num">{{ attendance.upcoming }}</div><div class="lbl">待上课程</div></div>
      <div class="card stat"><div class="num">{{ records.length }}</div><div class="lbl">课后记录</div></div>
    </div>

    <div class="card" v-if="pkg">
      <h3>当前课包</h3>
      <PackageCard :pkg="pkg" />
      <div v-if="pkg.extensions.length" class="mt16">
        <div class="muted mb8">📌 课包书面承诺记录（{{ pkg.extensions.length }}/{{ pkg.extensionRule.maxExtensions }} 次）</div>
        <div v-for="e in pkg.extensions" :key="e.id" class="promise-item">
          <div class="between">
            <b>第 {{ pkg.extensions.indexOf(e) + 1 }} 次 · {{ e.kind }} · {{ e.appliedAt }}</b>
            <span class="tag amber">书面留档</span>
          </div>
          <div class="muted">{{ e.promiseNote }}</div>
        </div>
      </div>
    </div>

    <!-- ============ 续费提醒：出勤 / 请假 / 训练效果 / 教练建议 ============ -->
    <div v-if="brief" class="card brief-card">
      <div class="between">
        <h3>📋 续费提醒（系统结合训练记录生成）</h3>
        <span class="tag danger">剩 {{ brief.schedule.remaining }} 节 · {{ brief.schedule.daysLeft }} 天到期</span>
      </div>

      <div class="grid cols-2 mt8">
        <div class="brief-box">
          <div class="brief-h">✅ 出勤</div>
          <div>已完成 <b>{{ brief.attendance.done }}</b> 节，会员请假 <b>{{ brief.attendance.leave }}</b> 次，待上 {{ brief.attendance.upcoming }} 节<template v-if="brief.attendance.rate != null">，出勤率 <b>{{ brief.attendance.rate }}%</b></template>。</div>
        </div>
        <div class="brief-box">
          <div class="brief-h">📝 请假记录</div>
          <template v-if="brief.leaves.length">
            <div v-for="(l, i) in brief.leaves" :key="i" class="brief-line">
              {{ l.date }}：{{ l.reason }}
              <span class="tag" :class="l.withinRule ? 'gray' : 'danger'">{{ l.withinRule ? '符合规则' : '超出规则' }}</span>
            </div>
          </template>
          <div v-else>无请假记录</div>
        </div>
        <div class="brief-box">
          <div class="brief-h">📈 训练效果</div>
          <template v-if="brief.effects.pain.length">
            <div v-for="(p, i) in brief.effects.pain" :key="i" class="brief-line">{{ p }}</div>
          </template>
          <div v-else class="muted">无疼痛记录</div>
          <div class="brief-line" v-if="brief.effects.feelAvg != null">课后平均体感 {{ brief.effects.feelAvg }}/10</div>
          <div class="brief-line" v-if="brief.effects.lastRecordDate">最近一课（{{ brief.effects.lastRecordDate }}）教练备注：{{ brief.effects.lastRecordNote }}</div>
        </div>
        <div class="brief-box">
          <div class="brief-h">🧑‍🏫 教练建议</div>
          <div class="brief-line">{{ brief.coachAdvice.advice }}</div>
          <div class="brief-line" v-if="brief.coachAdvice.recommended">推荐套餐：{{ brief.coachAdvice.recommended }}</div>
          <div class="muted" style="font-size: 12px">（来自教练签署的测评档案与课后记录，顾问只读引用）</div>
        </div>
      </div>

      <div class="banner" :class="brief.schedule.gap > 0 ? 'danger' : 'warn'">
        <b>课包日历测算：</b>当前频率「{{ brief.schedule.slots }}」，到期日前还可排 <b>{{ brief.schedule.canFinish }}</b> 节；
        <template v-if="brief.schedule.gap > 0">剩余 {{ brief.schedule.remaining }} 节中有 <b>{{ brief.schedule.gap }}</b> 节无法在有效期内完成，沟通时需给出
          <b>续费 / 书面延期 / 调整上课频率</b> 的明确方案，不得口头承诺延期。</template>
        <template v-else>剩余课程可在到期前完成，可正常沟通续费。</template>
      </div>
    </div>

    <!-- ============ 延期 / 调频率（书面申请 → 审批 → 日历重排） ============ -->
    <div v-if="pkg && extInfo" class="card">
      <h3>📝 延期 / 调整上课频率（书面承诺，审批后生效）</h3>
      <div class="banner warn">
        <b>合同规则：</b>{{ pkg.extensionRule.note }}
        <br />本课包已延期 <b>{{ extInfo.used }}</b>/{{ pkg.extensionRule.maxExtensions }} 次（剩余 {{ extInfo.left }} 次），
        累计顺延 <b>{{ extInfo.daysUsed }}</b>/{{ pkg.extensionRule.maxDaysTotal }} 天（剩余 {{ extInfo.daysLeft }} 天）。
      </div>

      <div v-if="!extInfo.canApply" class="banner danger">
        该课包延期次数或累计天数已达合同上限，顾问不能再承诺延期；可与会员沟通续费，或仅申请调整上课频率。
      </div>

      <!-- 申请记录 -->
      <div v-if="pkgRequests.length" class="mb16">
        <div v-for="r in pkgRequests" :key="r.id" class="req-item">
          <div class="between">
            <div>
              <span class="tag" :class="r.status === '待审批' ? 'amber' : r.status === '已通过' ? '' : 'gray'">{{ r.status }}</span>
              <b>{{ r.kind }}</b>
              <span class="muted">{{ r.createdAt }} · {{ r.consultantName }} 发起<span v-if="r.reviewerName"> · {{ r.reviewerName }} 审批</span></span>
            </div>
          </div>
          <div class="muted mt8">原因：{{ r.reason }}</div>
          <div class="muted">承诺：{{ r.promiseNote }}</div>
          <div v-if="r.status === '已驳回'" class="muted" style="color: var(--danger)">驳回原因：{{ r.rejectReason }}</div>
          <div v-if="r.status === '待审批'" class="row mt8">
            <button class="small" @click="approve(r)">审批通过（自动重排日历）</button>
            <input v-model="rejectText[r.id]" placeholder="驳回原因（写入会员记录）" style="flex: 1; max-width: 320px" />
            <button class="small ghost" @click="reject(r)">驳回</button>
          </div>
        </div>
      </div>

      <!-- 申请表单 -->
      <div class="checks mb8">
        <label :class="{ on: extForm.kind === '延期' }"><input type="radio" value="延期" v-model="extForm.kind" />仅延期</label>
        <label :class="{ on: extForm.kind === '调整频率' }"><input type="radio" value="调整频率" v-model="extForm.kind" />仅调整频率</label>
        <label :class="{ on: extForm.kind === '延期并调整频率' }"><input type="radio" value="延期并调整频率" v-model="extForm.kind" />延期并调整频率</label>
      </div>

      <div class="grid cols-2">
        <div class="form-row" v-if="extendsExpiry">
          <label>延期天数（单次最多 {{ pkg.extensionRule.maxDaysPerTime }} 天）</label>
          <div class="row">
            <input v-model.number="extForm.extendDays" type="number" min="1" :max="pkg.extensionRule.maxDaysPerTime" style="width: 100px" />
            <span class="muted">天 · 延期后有效期至 <b>{{ preview?.newExpiryDate }}</b></span>
          </div>
        </div>
        <div class="form-row" v-if="changesFreq">
          <label>调整后上课频率（当前：{{ slotsText(currentSlots) }}）</label>
          <div class="checks">
            <label v-for="(w, i) in WEEKDAYS" :key="i" :class="{ on: extForm.weekdays.has(i) }">
              <input type="checkbox" :checked="extForm.weekdays.has(i)" @change="toggleWeekday(i)" />{{ w }}
            </label>
          </div>
          <select v-model="extForm.time" style="margin-top: 8px; width: 160px">
            <option v-for="t in TIMES" :key="t">{{ t }}</option>
          </select>
          <div class="muted mt8">新频率：<b>{{ slotsText(newSlots) }}</b></div>
        </div>
      </div>

      <div class="form-row">
        <label>会员无法按期完成的原因（书面记录，会员可见）</label>
        <textarea v-model="extForm.reason" rows="2" placeholder="如：年底项目冲刺，经常加班到 21 点，无法保证每周一上课"></textarea>
      </div>

      <!-- 日历重排预览 -->
      <div v-if="preview" class="mt8">
        <label>课包日历重排预览（剩余 {{ preview.rows.length }} 节待上课，审批通过后自动生效）</label>
        <table class="plain">
          <thead><tr><th>原日期</th><th>原时间</th><th></th><th>新日期</th><th>新时间</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="row in preview.rows" :key="row.id">
              <td>{{ row.oldDate }}（{{ weekdayCn(row.oldDate) }}）</td>
              <td>{{ row.oldTime }}</td>
              <td>→</td>
              <td>{{ row.newDate }}（{{ weekdayCn(row.newDate) }}）</td>
              <td>{{ row.newTime }}</td>
              <td>
                <span v-if="row.outOfRange" class="tag danger">仍超出有效期</span>
                <span v-else class="tag" :class="row.changed ? 'amber' : 'gray'">{{ row.changed ? '自动改期' : '不变' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="muted mt8">
          重排后 {{ preview.within }}/{{ preview.rows.length }} 节落在新有效期（{{ preview.newExpiryDate }}）之内<template v-if="preview.rows.length - preview.within > 0">；
          <b style="color: var(--danger)">{{ preview.rows.length - preview.within }} 节仍排不下</b>，仅靠延期/调频率无法上完，需建议会员提高频率或续费</template>。
        </div>
      </div>

      <div class="row mt8">
        <button @click="submitExtension" :disabled="pkgRequests.some(r => r.status === '待审批')">提交书面申请（待审批）</button>
        <button class="ghost" @click="resetExtForm">重置为当前频率</button>
        <span class="muted">申请通过前课表不变；通过后自动改期并把承诺写入课包记录，防止口头争议。</span>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h3>疼痛趋势（真实训练数据）</h3>
        <template v-if="trend.length">
          <div v-for="(t, i) in trend" :key="i" class="pain-bar mb8">
            <span class="muted" style="width: 90px">{{ t.date.slice(0, 10) }}</span>
            <span style="width: 50px">{{ t.part }}</span>
            <span class="pain-dots"><i v-for="n in 10" :key="n" :class="{ on: n <= t.after }"></i></span>
            <span>{{ t.before }}→{{ t.after }}</span>
          </div>
        </template>
        <div v-else class="empty">无疼痛记录</div>
      </div>

      <div class="card">
        <h3>最近课后记录（教练填写）</h3>
        <div v-for="r in records.slice(0, 3)" :key="r.id" class="mb8" style="border-bottom: 1px solid var(--line); padding-bottom: 8px">
          <div class="between">
            <b>{{ r.createdAt.slice(0, 10) }}</b>
            <span class="muted">{{ data.coachById(r.coachId)?.name }} · 体感 {{ r.memberFeel }}/10</span>
          </div>
          <div style="font-size: 13px">完成：{{ r.completedMoves.join('、') }}</div>
          <div class="muted" style="font-size: 13px">备注：{{ r.coachNote }}</div>
        </div>
        <div v-if="!records.length" class="empty">暂无记录</div>
      </div>
    </div>

    <!-- 销售/训练边界：专业档案只读 -->
    <div class="card">
      <h3>教练专业档案</h3>
      <ProfessionalProfile :member-id="mid" viewer-role="consultant" />
    </div>

    <!-- 续费跟进 -->
    <div class="card">
      <h3>续费跟进</h3>
      <p class="muted">沟通要点由真实训练数据生成：出勤、请假、训练效果、教练建议、课包日历测算 —— 不只是「还剩几节课」。</p>
      <div class="form-row">
        <div class="between">
          <label>沟通纪要</label>
          <button class="small ghost" @click="draftSummary">✨ 基于训练记录生成要点</button>
        </div>
        <textarea v-model="follow.summary" rows="3"></textarea>
      </div>
      <div class="row">
        <select v-model="follow.result" style="width: 140px">
          <option>跟进中</option><option>已续费</option><option>暂缓</option>
        </select>
        <template v-if="follow.result === '已续费'">
          <input v-model="renewSpec.name" style="width: 220px" />
          <input v-model.number="renewSpec.totalSessions" type="number" min="1" style="width: 90px" title="课时" />
          <span class="muted">节 /</span>
          <input v-model.number="renewSpec.validDays" type="number" min="7" style="width: 90px" title="有效期" />
          <span class="muted">天</span>
        </template>
        <button @click="submitFollow">保存跟进</button>
      </div>
      <div v-if="renewals.length" class="mt16">
        <div v-for="r in renewals" :key="r.id" class="mb8" style="font-size: 13px; border-bottom: 1px dashed var(--line); padding-bottom: 6px">
          <span class="tag" :class="r.result === '已续费' ? '' : r.result === '暂缓' ? 'gray' : 'amber'">{{ r.result }}</span>
          <span class="muted">{{ r.createdAt }}</span> — {{ r.summary }}
        </div>
      </div>
    </div>

    <!-- 投诉处理 -->
    <div v-if="complaints.length" class="card">
      <h3>投诉处理</h3>
      <div v-for="c in complaints" :key="c.id" class="mb8">
        <div><span class="tag danger">{{ c.status }}</span> {{ c.content }}</div>
        <div v-if="c.reply" class="muted">已回复：{{ c.reply }}</div>
        <div v-else class="row mt8">
          <input v-model="complaintReply[c.id]" placeholder="回复内容" style="flex: 1" />
          <button class="small" @click="reply(c.id)">回复</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>完整训练记录（与会员、教练看到的是同一份）</h3>
      <TrainingTimeline :member-id="mid" />
    </div>
  </div>
  <div v-else class="page"><div class="empty">会员不存在</div></div>
</template>

<style scoped>
.brief-card .brief-box {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 14px;
  background: #fffdf9;
  font-size: 13px;
}
.brief-h { font-weight: 600; color: var(--sage-deep); margin-bottom: 6px; }
.brief-line { margin: 3px 0; }
.promise-item, .req-item {
  border: 1px solid var(--line);
  border-left: 3px solid var(--amber);
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 8px;
  background: #fffdf9;
  font-size: 13px;
}
.mb16 { margin-bottom: 16px; }
</style>
