<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import PackageCard from '../../components/PackageCard.vue'
import CommitmentList from '../../components/CommitmentList.vue'
import { EXTENSION_POLICY, type WeekdaySlot } from '../../types'
import { weekdayCn, WEEKDAY_CN } from '../../utils/date'

const route = useRoute()
const auth = useAuthStore()
const data = useDataStore()
const mid = route.params.id as string
const myName = auth.current!.name

const member = computed(() => data.accountById(mid))
const pkg = computed(() => data.activePackage(mid))
const prog = computed(() => pkg.value ? data.progressOf(pkg.value) : null)
const attendance = computed(() => data.attendanceOf(mid))
const trend = computed(() => data.painTrend(mid))
const records = computed(() => data.recordsOf(mid))
const assessment = computed(() => data.latestAssessment(mid))
const upcoming = computed(() => data.upcomingSessions(mid).filter(s => !s.isExperience))
const leaves = computed(() => data.memberLeavesOf(mid))
const renewals = computed(() => data.renewals.filter(r => r.memberId === mid))
const extensions = computed(() => data.extensionsOf(mid))
const check = computed(() => pkg.value ? data.extensionCheck(pkg.value) : null)
const pendingReq = computed(() => extensions.value.find(e => e.status === '待审批'))

const msg = ref('')
const err = ref('')
function flash(t: string) { msg.value = t; err.value = ''; setTimeout(() => (msg.value = ''), 3000) }
function flashErr(t: string) { err.value = t; msg.value = ''; setTimeout(() => (err.value = ''), 4000) }

// ---------- 续费沟通要点：结合出勤、请假、训练效果、教练建议 ----------
const follow = reactive({ summary: '', result: '跟进中' as '跟进中' | '已续费' | '暂缓' })
const renewSpec = reactive({ name: '私教 24 节 · 进阶周期', totalSessions: 24, validDays: 120, weekday: 2, time: '19:00-20:00' })

function draftSummary() {
  const parts: string[] = []
  if (pkg.value && prog.value) {
    parts.push(`课包消耗 ${pkg.value.usedSessions}/${pkg.value.totalSessions} 节，剩余 ${prog.value.remaining} 节、${prog.value.daysLeft} 天后到期（${pkg.value.expiryDate}）`)
    if (pkg.value.extensionCount > 0) parts.push(`已延期 ${pkg.value.extensionCount}/${EXTENSION_POLICY.maxTimes} 次`)
  }
  // 出勤与请假
  parts.push(`出勤：完成 ${attendance.value.done} 节、请假 ${attendance.value.leave} 次、待上 ${attendance.value.upcoming} 节`)
  const lastLeave = leaves.value.filter(l => l.status === '已批准').slice(-1)[0]
  if (lastLeave) parts.push(`最近请假原因「${lastLeave.reason}」`)
  // 训练效果
  if (trend.value.length) {
    const first = trend.value[0]
    const last = trend.value[trend.value.length - 1]
    parts.push(`训练效果：${last.part}疼痛由首次 ${first.before} 分降至最近 ${last.after} 分`)
  }
  const feels = records.value.map(r => r.memberFeel)
  if (feels.length) parts.push(`平均体感 ${(feels.reduce((a, b) => a + b, 0) / feels.length).toFixed(1)}/10`)
  const lastRec = records.value[0]
  if (lastRec) parts.push(`最近一课教练备注「${lastRec.coachNote}」`)
  // 教练建议
  if (assessment.value) parts.push(`教练建议：${assessment.value.courseAdvice}`)
  follow.summary = `基于训练记录沟通：${parts.join('；')}。`
}

function submitFollow() {
  if (!follow.summary.trim()) { flashErr('请填写沟通纪要'); return }
  data.followUpRenewal(
    mid, auth.current!.id, follow.summary, follow.result, myName,
    follow.result === '已续费'
      ? { name: renewSpec.name, totalSessions: renewSpec.totalSessions, validDays: renewSpec.validDays, slots: [{ weekday: renewSpec.weekday, time: renewSpec.time }] }
      : undefined,
  )
  follow.summary = ''
  flash(follow.result === '已续费' ? '已生成新课包并与原课包衔接，续费承诺已写入课包记录' : '跟进记录已保存')
}

// ---------- 延期 / 调频申请 ----------
const ext = reactive({
  mode: 'extend' as 'extend' | 'frequency',
  extendDays: 14,
  reason: '会员工作原因（出差/加班），无法按原到期日完成剩余课程',
  changeSlots: true,
  weekday1: 1, time1: '19:00-20:00',
  weekday2: 4, time2: '19:00-20:00',
  twoSlots: true,
})

const newSlotsPreview = computed<WeekdaySlot[]>(() => {
  if (!ext.changeSlots) return []
  const slots: WeekdaySlot[] = [{ weekday: ext.weekday1, time: ext.time1 }]
  if (ext.twoSlots) slots.push({ weekday: ext.weekday2, time: ext.time2 })
  return slots
})

function submitExtension() {
  if (!pkg.value) return
  if (!ext.reason.trim()) { flashErr('请填写申请原因（将写入课包记录）'); return }
  const days = ext.mode === 'extend' ? ext.extendDays : 0
  if (ext.mode === 'extend' && (!days || days < 1)) { flashErr('请填写延期天数'); return }
  const res = data.submitExtensionRequest(pkg.value.id, auth.current!.id, myName, {
    reason: ext.reason, extendDays: days, newSlots: newSlotsPreview.value,
  })
  if (!res.canApply) { flashErr(res.blockReason); return }
  flash('申请已提交店长审批；通过后课包日历将自动重排，承诺写入课包记录')
}

// ---------- 手动承诺 ----------
const promiseText = ref('')
function submitPromise() {
  if (!pkg.value) return
  if (!promiseText.value.trim()) { flashErr('请填写承诺内容'); return }
  data.addCommitment(pkg.value.id, 'consultant', myName, promiseText.value.trim())
  promiseText.value = ''
  flash('承诺已写入课包记录，会员与教练可见同一份')
}

const statusClass: Record<string, string> = { 待审批: 'amber', 已通过: '', 已拒绝: 'danger' }
</script>

<template>
  <div class="page" v-if="member">
    <h2 class="page-title">{{ member.name }} · 续费沟通</h2>
    <p class="page-sub">续费提醒由真实训练数据生成：出勤、请假、训练效果、教练建议 —— 延期与承诺全部写入课包记录，口头承诺无效。</p>

    <div v-if="msg" class="banner warn">{{ msg }}</div>
    <div v-if="err" class="banner danger">{{ err }}</div>

    <template v-if="pkg && prog && check">
      <!-- 到期预警 + 延期额度 -->
      <div class="banner danger" v-if="prog.expiringSoon">
        ⏰ 课包临近到期：剩余 <b>{{ prog.remaining }}</b> 节，<b>{{ prog.daysLeft }}</b> 天后到期（{{ pkg.expiryDate }}），
        当前仅排入 {{ attendance.upcoming }} 节 —— 请尽快与会员沟通续费或发起延期申请。
      </div>
      <div class="banner" :class="check.canApply ? '' : 'danger'">
        📜 {{ EXTENSION_POLICY.note }}
        <div class="mt8">
          本课包：已延期 <b>{{ pkg.extensionCount }}/{{ EXTENSION_POLICY.maxTimes }}</b> 次，
          累计 <b>{{ pkg.extensionDaysTotal }}/{{ EXTENSION_POLICY.maxTotalDays }}</b> 天，
          剩余额度 <b>{{ check.timesLeft }}</b> 次 / <b>{{ check.daysLeft }}</b> 天。
          <span v-if="!check.canApply" style="color: var(--danger)"><b>{{ check.blockReason }}</b></span>
        </div>
      </div>

      <div class="card">
        <h3>当前课包</h3>
        <PackageCard :pkg="pkg" />
      </div>

      <!-- 续费提醒的数据依据 -->
      <div class="grid cols-4">
        <div class="card stat"><div class="num">{{ attendance.done }}</div><div class="lbl">已完成课程</div></div>
        <div class="card stat"><div class="num">{{ attendance.leave }}</div><div class="lbl">请假次数</div></div>
        <div class="card stat"><div class="num">{{ records.length }}</div><div class="lbl">课后记录</div></div>
        <div class="card stat"><div class="num">{{ prog.daysLeft }}</div><div class="lbl">天后到期</div></div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <h3>训练效果（真实数据）</h3>
          <template v-if="trend.length">
            <div v-for="(t, i) in trend" :key="i" class="pain-bar mb8">
              <span class="muted" style="width: 90px">{{ t.date.slice(0, 10) }}</span>
              <span style="width: 50px">{{ t.part }}</span>
              <span class="pain-dots"><i v-for="n in 10" :key="n" :class="{ on: n <= t.after }"></i></span>
              <span>{{ t.before }}→{{ t.after }}</span>
            </div>
          </template>
          <div v-else class="empty">无疼痛记录</div>
          <div v-if="records.length" class="mt8 muted">
            最近一课（{{ records[0].createdAt.slice(0, 10) }}）体感 {{ records[0].memberFeel }}/10；教练备注：{{ records[0].coachNote }}
          </div>
        </div>

        <div class="card">
          <h3>教练建议（专业档案摘要）</h3>
          <template v-if="assessment">
            <dl class="kv">
              <dt>课程建议</dt><dd>{{ assessment.courseAdvice }}</dd>
              <dt>动作限制</dt><dd>{{ assessment.movementLimits }}</dd>
              <dt>推荐套餐</dt><dd>{{ assessment.recommendedPackage }}</dd>
            </dl>
            <div class="muted mt8">🔒 专业内容由 {{ data.coachById(assessment.coachId)?.name }} 签署，顾问只读。</div>
          </template>
          <div v-else class="empty">暂无测评档案</div>
        </div>
      </div>

      <!-- 续费沟通 -->
      <div class="card">
        <h3>续费沟通</h3>
        <p class="muted">一键生成结合出勤、请假、训练效果与教练建议的沟通要点，保存后写入训练记录。</p>
        <div class="form-row">
          <div class="between">
            <label>沟通纪要</label>
            <button class="small ghost" @click="draftSummary">✨ 基于训练记录生成要点</button>
          </div>
          <textarea v-model="follow.summary" rows="4"></textarea>
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

      <!-- 延期 / 调频申请 -->
      <div class="card">
        <h3>延期 / 调整上课频率申请</h3>
        <p class="muted">会员因工作等原因无法按期完成时，由顾问发起申请、店长审批；通过后课包日历自动重排，承诺写入课包记录。</p>
        <div v-if="!check.canApply" class="banner danger">
          🚫 {{ check.blockReason }}
        </div>
        <div v-else-if="pendingReq" class="banner warn">
          ⏳ 已有一条待审批申请（{{ pendingReq.createdAt }}），请等待店长审批结果。
        </div>
        <template v-else>
          <div class="checks mb8">
            <label :class="{ on: ext.mode === 'extend' }"><input type="radio" value="extend" v-model="ext.mode" />延期（延长有效期）</label>
            <label :class="{ on: ext.mode === 'frequency' }"><input type="radio" value="frequency" v-model="ext.mode" />仅调整上课频率</label>
          </div>
          <div class="grid cols-2">
            <div class="form-row" v-if="ext.mode === 'extend'">
              <label>延期天数（单次 ≤ {{ EXTENSION_POLICY.maxDaysPerTime }} 天，剩余额度 {{ check.daysLeft }} 天）</label>
              <input v-model.number="ext.extendDays" type="number" min="1" :max="Math.min(EXTENSION_POLICY.maxDaysPerTime, check.daysLeft)" />
            </div>
            <div class="form-row">
              <label>申请原因（写入课包记录）</label>
              <textarea v-model="ext.reason" rows="2"></textarea>
            </div>
          </div>
          <div class="form-row">
            <label class="row" style="align-items: center">
              <input type="checkbox" v-model="ext.changeSlots" style="width: auto" />
              <span style="color: var(--ink)">同时调整每周固定时段（审批通过后按新频率自动重排剩余课程）</span>
            </label>
          </div>
          <div v-if="ext.changeSlots" class="grid cols-2">
            <div class="form-row">
              <label>时段一</label>
              <div class="row">
                <select v-model.number="ext.weekday1" style="width: auto">
                  <option v-for="(w, i) in WEEKDAY_CN" :key="i" :value="i">{{ w }}</option>
                </select>
                <select v-model="ext.time1" style="width: auto">
                  <option>10:00-11:00</option><option>14:00-15:00</option>
                  <option>19:00-20:00</option><option>20:00-21:00</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <label class="row" style="align-items: center">
                <input type="checkbox" v-model="ext.twoSlots" style="width: auto" />
                <span style="color: var(--ink)">每周两节（加快课消）</span>
              </label>
              <div v-if="ext.twoSlots" class="row">
                <select v-model.number="ext.weekday2" style="width: auto">
                  <option v-for="(w, i) in WEEKDAY_CN" :key="i" :value="i">{{ w }}</option>
                </select>
                <select v-model="ext.time2" style="width: auto">
                  <option>10:00-11:00</option><option>14:00-15:00</option>
                  <option>19:00-20:00</option><option>20:00-21:00</option>
                </select>
              </div>
            </div>
          </div>
          <button @click="submitExtension">提交店长审批</button>
        </template>

        <template v-if="extensions.length">
          <h3 class="mt16">申请历史</h3>
          <div v-for="e in extensions" :key="e.id" class="mb8" style="font-size: 13px; border-bottom: 1px dashed var(--line); padding-bottom: 6px">
            <span class="tag" :class="statusClass[e.status]">{{ e.status }}</span>
            <span class="muted">{{ e.createdAt }} · {{ e.consultantName }}</span>
            {{ e.extendDays > 0 ? `延期 ${e.extendDays} 天` : '调整频率' }} — {{ e.reason }}
            <div v-if="e.status !== '待审批'" class="muted">审批：{{ e.decidedBy }} · {{ e.decidedAt }}<span v-if="e.decideNote"> · {{ e.decideNote }}</span></div>
          </div>
        </template>
      </div>

      <!-- 承诺记录 -->
      <div class="card">
        <h3>课包承诺记录（防止口头延期争议）</h3>
        <p class="muted">对会员的每一项承诺都必须落字于此，会员、教练、店长可见同一份。</p>
        <CommitmentList :package-id="pkg.id" />
        <div class="row mt16">
          <input v-model="promiseText" placeholder="记录新的沟通承诺，如：会员承诺每周三 19:00 固定到馆" style="flex: 1" />
          <button class="small" @click="submitPromise">写入承诺</button>
        </div>
      </div>

      <!-- 课包日历（重排结果） -->
      <div class="card">
        <h3>课包日历（剩余课程排期）</h3>
        <table v-if="upcoming.length" class="plain">
          <thead><tr><th>日期</th><th>时间</th><th>教练</th><th>本节课重点</th></tr></thead>
          <tbody>
            <tr v-for="s in upcoming" :key="s.id">
              <td>{{ s.date }}（{{ weekdayCn(s.date) }}）</td>
              <td>{{ s.time }}</td>
              <td>{{ data.coachById(s.coachId)?.name }}</td>
              <td>{{ s.focus }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">暂无待上课程</div>
      </div>
    </template>
    <div v-else class="card"><div class="empty">该会员当前没有进行中的课包</div></div>
  </div>
  <div v-else class="page"><div class="empty">会员不存在</div></div>
</template>
