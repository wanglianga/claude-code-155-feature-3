<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import PackageCard from '../../components/PackageCard.vue'
import ProfessionalProfile from '../../components/ProfessionalProfile.vue'
import { weekdayCn } from '../../utils/date'

const auth = useAuthStore()
const data = useDataStore()
const mid = auth.current!.id

const pkg = computed(() => data.activePackage(mid))
const upcoming = computed(() => data.upcomingSessions(mid))
const booking = computed(() => data.bookingOf(mid))
const assessment = computed(() => data.latestAssessment(mid))
const prog = computed(() => pkg.value ? data.progressOf(pkg.value) : null)

// ---- 确认购课 ----
const showPurchase = ref(false)
const purchase = reactive({ name: '', totalSessions: 16, validDays: 90, weekday: 2, time: '19:00-20:00' })
const canPurchase = computed(() => booking.value?.status === '已完成测评' && !pkg.value)

function openPurchase() {
  purchase.name = assessment.value?.recommendedPackage ?? '私教 16 节'
  const m = assessment.value?.recommendedPackage.match(/(\d+)\s*节/)
  if (m) purchase.totalSessions = Number(m[1])
  showPurchase.value = true
}

function confirmPurchase() {
  if (!assessment.value) return
  data.purchasePackage(mid, assessment.value.coachId, purchase.name, purchase.totalSessions, purchase.validDays,
    [{ weekday: purchase.weekday, time: purchase.time }], auth.current!.name)
  showPurchase.value = false
}

const expSession = computed(() => upcoming.value.find(s => s.isExperience))
</script>

<template>
  <div class="page">
    <h2 class="page-title">你好，{{ auth.current?.name }}</h2>
    <p class="page-sub">你的每一次疼痛、请假与训练效果，都会成为后续排课的依据。</p>

    <!-- 续费 / 到期提醒 -->
    <div v-if="prog?.expiringSoon" class="banner danger">
      ⏰ 课包续费提醒：剩余 <b>{{ prog.remaining }}</b> 节，有效期还剩 <b>{{ prog.daysLeft }}</b> 天。
      顾问会结合你的出勤、请假、训练效果与教练建议与你沟通续费方案；如因工作原因无法按期完成，
      可由顾问发起<b>书面延期或调整上课频率</b>（合同最多 {{ pkg?.extensionRule.maxExtensions }} 次），
      审批通过后课表自动重排——所有承诺以课包记录为准，口头延期无效。
    </div>
    <div v-if="prog?.behind" class="banner warn">
      📉 课消进度落后：按当前上课频率，课包到期前可能上不完，建议与顾问协商加课、书面延期或调整排课。
    </div>

    <!-- 体验课流程状态 -->
    <div v-if="booking && booking.status === '待安排'" class="banner warn">
      ✅ 体验课预约已提交，顾问正在为你匹配教练（已记录：{{ booking.mindOppositeGenderCoach ? '介意异性教练' : '不介意教练性别' }}、{{ booking.availableSlots.join(' / ') }} 可上课）。
    </div>
    <div v-if="expSession" class="banner">
      🗓 体验课已安排：<b>{{ expSession.date }}（{{ weekdayCn(expSession.date) }}）{{ expSession.time }}</b>，
      教练：{{ data.coachById(expSession.coachId)?.name }}
    </div>

    <!-- 确认购课 -->
    <div v-if="canPurchase" class="card">
      <h3>体验测评已完成，确认购课后自动生成课包与排课计划</h3>
      <ProfessionalProfile :member-id="mid" viewer-role="member" />
      <div class="mt16" v-if="!showPurchase">
        <button @click="openPurchase">确认购买推荐套餐</button>
      </div>
      <div v-else class="mt16">
        <div class="grid cols-2">
          <div class="form-row"><label>课包名称</label><input v-model="purchase.name" /></div>
          <div class="form-row"><label>总课时</label><input v-model.number="purchase.totalSessions" type="number" min="1" /></div>
          <div class="form-row"><label>有效期（天）</label><input v-model.number="purchase.validDays" type="number" min="7" /></div>
          <div class="form-row">
            <label>固定上课时段</label>
            <div class="row">
              <select v-model.number="purchase.weekday" style="width: auto">
                <option v-for="(w, i) in ['周日','周一','周二','周三','周四','周五','周六']" :key="i" :value="i">{{ w }}</option>
              </select>
              <select v-model="purchase.time" style="width: auto">
                <option>10:00-11:00</option><option>14:00-15:00</option>
                <option>19:00-20:00</option><option>20:00-21:00</option>
              </select>
            </div>
          </div>
        </div>
        <div class="banner">请假规则：每月最多请假 2 次，需提前 12 小时；课包剩余 4 节或到期前 21 天自动提醒续费。</div>
        <div class="row">
          <button @click="confirmPurchase">确认购买并生成排课</button>
          <button class="ghost" @click="showPurchase = false">再想想</button>
        </div>
      </div>
    </div>

    <!-- 当前课包 -->
    <div v-if="pkg" class="card">
      <h3>当前课包</h3>
      <PackageCard :pkg="pkg" />
    </div>

    <!-- 近期课程 -->
    <div class="card">
      <h3>近期课程</h3>
      <table v-if="upcoming.length" class="plain">
        <thead><tr><th>日期</th><th>时间</th><th>类型</th><th>教练</th><th>本节课重点</th><th>状态</th></tr></thead>
        <tbody>
          <tr v-for="s in upcoming.slice(0, 6)" :key="s.id">
            <td>{{ s.date }}（{{ weekdayCn(s.date) }}）</td>
            <td>{{ s.time }}</td>
            <td><span class="tag" :class="s.isExperience ? 'clay' : ''">{{ s.kind }}</span></td>
            <td>{{ data.coachById(s.coachId)?.name }}</td>
            <td>{{ s.focus }}</td>
            <td><span class="tag">{{ s.status }}</span></td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">暂无待上课程</div>
    </div>
  </div>
</template>
