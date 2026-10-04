import { defineStore } from 'pinia'
import type {
  Account, Assessment, CoachProfile, Complaint, CoursePackage, ExperienceBooking,
  ExtensionRequest, LeaveRequest, PackageExtension, PainChange, RenewalFollowUp,
  SchedulePlan, Session, SessionRecord, Ticket, TicketType, TimelineEvent, TimelineKind, WeekSlot,
} from '../types'
import { buildSeed, SEED_VERSION, type SeedState } from '../data/seed'
import { addDays, daysBetween, nowStr, relayoutSessions, sessionsBeforeExpiry, slotsText, today, uid, upcomingDates, weekdayCn } from '../utils/date'

const KEY = `yoga_db_v${SEED_VERSION}`

export interface WeekdaySlot { weekday: number; time: string }

export const useDataStore = defineStore('data', {
  state: (): SeedState => buildSeed(),

  getters: {
    accountById: (s) => (id: string): Account | undefined => s.accounts.find(a => a.id === id),
    coachById: (s) => (id: string): CoachProfile | undefined => s.coaches.find(c => c.id === id),
    nameOf(): (id: string) => string {
      return (id) => this.accountById(id)?.name ?? this.coachById(id)?.name ?? id
    },

    memberIds: (s) => s.accounts.filter(a => a.role === 'member').map(a => a.id),

    activePackage: (s) => (memberId: string): CoursePackage | undefined =>
      s.packages.find(p => p.memberId === memberId && p.status === '进行中'),

    packagesOf: (s) => (memberId: string) =>
      s.packages.filter(p => p.memberId === memberId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

    sessionsOf: (s) => (memberId: string) =>
      s.sessions.filter(x => x.memberId === memberId).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),

    coachSessions: (s) => (coachId: string) =>
      s.sessions.filter(x => x.coachId === coachId).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),

    upcomingSessions: (s) => (memberId: string) =>
      s.sessions.filter(x => x.memberId === memberId && x.status === '待上课' && x.date >= today())
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),

    recordOf: (s) => (sessionId: string) => s.records.find(r => r.sessionId === sessionId),

    recordsOf: (s) => (memberId: string) =>
      s.records.filter(r => r.memberId === memberId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

    timelineOf: (s) => (memberId: string) =>
      s.timeline.filter(e => e.memberId === memberId).sort((a, b) => b.at.localeCompare(a.at)),

    latestAssessment: (s) => (memberId: string): Assessment | undefined =>
      s.assessments.filter(a => a.memberId === memberId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],

    bookingOf: (s) => (memberId: string) =>
      s.bookings.filter(b => b.memberId === memberId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],

    // ---- 顾问看板 ----
    funnel: (s) => {
      const c = { 待安排: 0, 已安排: 0, 已完成测评: 0, 已购课: 0, 已取消: 0 }
      s.bookings.forEach(b => { c[b.status] += 1 })
      return c
    },
    openTickets: (s) => s.tickets.filter(t => t.status !== '已解决'),
    pendingLeaves: (s) => s.leaves.filter(l => l.status === '待处理'),
    openComplaints: (s) => s.complaints.filter(c => c.status !== '已关闭'),

    /** 课包消耗进度：expected = 按时间线性应消耗 */
    progressOf: () => (p: CoursePackage) => {
      const totalDays = Math.max(1, daysBetween(p.startDate, p.expiryDate))
      const elapsed = Math.min(totalDays, Math.max(0, daysBetween(p.startDate, today())))
      const expected = (p.totalSessions * elapsed) / totalDays
      const remaining = p.totalSessions - p.usedSessions
      const daysLeft = daysBetween(today(), p.expiryDate)
      const behind = p.status === '进行中' && elapsed / totalDays > 0.15 && p.usedSessions < expected * 0.7
      const expiringSoon = p.status === '进行中' && (daysLeft <= 21 || remaining <= 4)
      return { totalDays, elapsed, expected: Math.round(expected * 10) / 10, remaining, daysLeft, behind, expiringSoon }
    },

    renewalAlerts(): { pkg: CoursePackage; remaining: number; daysLeft: number }[] {
      return this.packages
        .filter(p => p.status === '进行中')
        .map(p => ({ pkg: p, ...this.progressOf(p) }))
        .filter(x => x.expiringSoon)
        .map(x => ({ pkg: x.pkg, remaining: x.remaining, daysLeft: x.daysLeft }))
    },

    /** 会员疼痛趋势（续费沟通用真实数据） */
    painTrend: (s) => (memberId: string) => {
      const out: { date: string; part: string; before: number; after: number }[] = []
      s.records
        .filter(r => r.memberId === memberId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .forEach(r => r.painChanges.forEach(pc => out.push({ date: r.createdAt, part: pc.part, before: pc.before, after: pc.after })))
      return out
    },

    attendanceOf: (s) => (memberId: string) => {
      const ss = s.sessions.filter(x => x.memberId === memberId && !x.isExperience)
      return {
        done: ss.filter(x => x.status === '已完成').length,
        leave: ss.filter(x => x.status === '会员请假').length,
        upcoming: ss.filter(x => x.status === '待上课').length,
      }
    },

    // ---- 课包延期 / 调频率（所有承诺书面留档，禁止口头延期） ----
    slotsOf: (s) => (packageId: string): WeekSlot[] =>
      s.plans.filter(p => p.packageId === packageId && p.active)
        .map(p => ({ weekday: p.weekday, time: p.time }))
        .sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time)),

    /** 课包延期额度：已用次数 / 剩余次数 / 累计天数 */
    extensionInfo(): (pkg: CoursePackage) => {
      used: number; daysUsed: number; left: number; daysLeft: number; canApply: boolean
    } {
      return (pkg) => {
        const daysUsed = pkg.extensions.reduce((n, e) => n + (e.extendDays || 0), 0)
        const r = pkg.extensionRule
        const canApply = pkg.status === '进行中' && pkg.extensions.length < r.maxExtensions && daysUsed < r.maxDaysTotal
        return { used: pkg.extensions.length, daysUsed, left: r.maxExtensions - pkg.extensions.length, daysLeft: r.maxDaysTotal - daysUsed, canApply }
      }
    },

    pendingExtensions: (s) => s.extensionRequests.filter(r => r.status === '待审批'),

    /**
     * 按给定有效期与频率测算到期前可完成节数：
     * - 课包剩余课已全部排上日历时，以真实排课日期为准（含已被排到有效期外的课）；
     * - 尚有未排课时，按每周频率理论值补足估算。
     */
    finishableCount(): (pkg: CoursePackage, expiryDate: string, slots: WeekSlot[]) => number {
      return (pkg, expiryDate, slots) => {
        const remaining = pkg.totalSessions - pkg.usedSessions
        const upcoming = this.sessions
          .filter(x => x.packageId === pkg.id && x.status === '待上课' && !x.isExperience && x.date >= today())
        const within = upcoming.filter(x => x.date <= expiryDate).length
        if (upcoming.length >= remaining) return within
        return Math.max(within, sessionsBeforeExpiry(expiryDate, slots))
      }
    },

    /** 会员某自然月已批准的请假次数（页面提示合同规则用） */
    monthLeaveCount: (s) => (memberId: string, month: string) => {
      const dateOf = new Map(s.sessions.map(x => [x.id, x]))
      return s.leaves.filter(l =>
        l.byRole === 'member' && l.status === '已批准' && dateOf.get(l.sessionId)?.memberId === memberId
        && (dateOf.get(l.sessionId)?.date.slice(0, 7) === month)).length
    },

    /**
     * 续费提醒四要素（页面结合真实数据生成，而非只看剩余课时）：
     * 出勤 / 请假 / 训练效果 / 教练建议 + 按当前频率能否在到期前上完
     */
    renewalBrief(): (memberId: string) => {
      attendance: { done: number; leave: number; upcoming: number; rate: number | null }
      leaves: { date: string; reason: string; withinRule: boolean }[]
      effects: { pain: string[]; feelAvg: number | null; lastRecordNote: string; lastRecordDate: string }
      coachAdvice: { advice: string; recommended: string; note: string }
      schedule: { slots: string; remaining: number; daysLeft: number; canFinish: number; gap: number }
    } | null {
      return (memberId) => {
        const pkg = this.activePackage(memberId)
        if (!pkg) return null
        const att = this.attendanceOf(memberId)
        const total = att.done + att.leave
        const rate = total ? Math.round((att.done / total) * 100) : null

        const dateOf = new Map(this.sessions.map(x => [x.id, x]))
        const leaves = this.leaves
          .filter(l => l.byRole === 'member' && dateOf.get(l.sessionId)?.memberId === memberId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(l => ({ date: dateOf.get(l.sessionId)?.date ?? l.createdAt.slice(0, 10), reason: l.reason, withinRule: l.withinRule }))

        const recs = this.recordsOf(memberId)
        const pain: string[] = []
        const byPart = new Map<string, { first: number; last: number }>()
        this.painTrend(memberId).forEach(p => {
          const cur = byPart.get(p.part)
          byPart.set(p.part, { first: cur?.first ?? p.before, last: p.after })
        })
        byPart.forEach((v, part) => pain.push(`${part} ${v.first} → ${v.last} 分（${v.last < v.first ? '缓解 ' + (v.first - v.last) + ' 分' : v.last > v.first ? '反复 ' + (v.last - v.first) + ' 分' : '持平'}）`))
        const feelVals = recs.map(r => r.memberFeel)
        const feelAvg = feelVals.length ? Math.round((feelVals.reduce((a, b) => a + b, 0) / feelVals.length) * 10) / 10 : null

        const assessment = this.latestAssessment(memberId)
        const slots = this.slotsOf(pkg.id)
        const prog = this.progressOf(pkg)
        const canFinish = this.finishableCount(pkg, pkg.expiryDate, slots)
        return {
          attendance: { ...att, rate },
          leaves,
          effects: {
            pain, feelAvg,
            lastRecordNote: recs[0]?.coachNote ?? '',
            lastRecordDate: recs[0]?.createdAt.slice(0, 10) ?? '',
          },
          coachAdvice: {
            advice: assessment?.courseAdvice ?? '暂无系统测评建议',
            recommended: assessment?.recommendedPackage ?? '',
            note: recs[0]?.coachNote ?? '',
          },
          schedule: {
            slots: slotsText(slots), remaining: prog.remaining, daysLeft: prog.daysLeft,
            canFinish, gap: prog.remaining - canFinish,
          },
        }
      }
    },

    /** 延期/调频率的日历重排预览（不落库）：仅延期时保留原日期、超期课前移补位；调频率时整体重排 */
    extensionPreview(): (packageId: string, extendDays: number, newSlots: WeekSlot[]) => {
      newExpiryDate: string
      rows: { id: string; oldDate: string; oldTime: string; newDate: string; newTime: string; changed: boolean; outOfRange: boolean }[]
      within: number
    } | null {
      return (packageId, extendDays, newSlots) => {
        const pkg = this.packages.find(p => p.id === packageId)
        if (!pkg) return null
        const keepDates = extendDays >= 0 && JSON.stringify(newSlots) === JSON.stringify(this.slotsOf(pkg.id))
        const pending = this.sessions
          .filter(x => x.packageId === packageId && x.status === '待上课' && !x.isExperience && x.date >= today())
          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        const newExpiryDate = addDays(pkg.expiryDate, extendDays)
        const laid = relayoutSessions(pending.map(s => ({ date: s.date, time: s.time })), newSlots, newExpiryDate, keepDates)
        const rows = pending.map((s, i) => ({
          id: s.id, oldDate: s.date, oldTime: s.time,
          newDate: laid[i].date, newTime: laid[i].time,
          changed: laid[i].changed, outOfRange: laid[i].outOfRange,
        }))
        return { newExpiryDate, rows, within: rows.filter(r => !r.outOfRange).length }
      }
    },
  },

  actions: {
    init() {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as SeedState
          Object.assign(this, parsed)
          return
        } catch { /* fallthrough */ }
      }
      this.resetDemo()
    },
    persist() {
      localStorage.setItem(KEY, JSON.stringify(this.$state))
    },
    resetDemo() {
      Object.assign(this, buildSeed())
      this.persist()
    },

    log(memberId: string, kind: TimelineKind, actorRole: 'member' | 'consultant' | 'coach', actorName: string, title: string, detail: string, professional = false) {
      this.timeline.push({ id: uid('tl'), memberId, at: nowStr(), kind, actorRole, actorName, title, detail, professional })
    },

    openTicket(type: TicketType, memberId: string, title: string, detail: string, coachId?: string, sessionId?: string) {
      this.tickets.unshift({ id: uid('tk'), type, memberId, coachId, sessionId, title, detail, createdAt: nowStr(), status: '待处理', resolution: '' })
    },

    // ---------- 会员：预约体验课 ----------
    bookExperience(memberId: string, payload: Omit<ExperienceBooking, 'id' | 'memberId' | 'createdAt' | 'status'>) {
      const b: ExperienceBooking = { ...payload, id: uid('bk'), memberId, createdAt: nowStr(), status: '待安排' }
      this.bookings.unshift(b)
      const m = this.accountById(memberId)
      this.log(memberId, '预约体验', 'member', m?.name ?? '', '预约体验课',
        `运动基础：${payload.fitnessBase}；疼痛：${payload.pains.map(p => `${p.part}${p.level}分`).join('、') || '无'}；柔韧性：${payload.flexibility}；目标：${payload.goals.join('、')}；预算：${payload.budget}；${payload.mindOppositeGenderCoach ? '介意异性教练' : '不介意教练性别'}。`)
      this.persist()
    },

    // ---------- 顾问：安排体验课 ----------
    arrangeExperience(bookingId: string, coachId: string, date: string, time: string, consultantName: string) {
      const b = this.bookings.find(x => x.id === bookingId)
      if (!b || b.status !== '待安排') return
      b.status = '已安排'
      this.sessions.push({
        id: uid('ss'), packageId: '', memberId: b.memberId, coachId, date, time,
        kind: '体验课', status: '待上课', focus: '体态评估与基础筛查', isExperience: true, bookingId: b.id,
      })
      const coach = this.coachById(coachId)
      this.log(b.memberId, '安排体验', 'consultant', consultantName, '安排体验课',
        `匹配${coach?.name}教练（${coach?.specialties.join('/')}），时间 ${date}（${weekdayCn(date)}）${time}。`)
      this.persist()
    },

    // ---------- 教练：填写体验测评（签名后锁定，顾问只读） ----------
    submitAssessment(bookingId: string, coachId: string, payload: { posture: string; movementLimits: string; courseAdvice: string; riskNotice: string; recommendedPackage: string }) {
      const b = this.bookings.find(x => x.id === bookingId)
      if (!b) return
      b.status = '已完成测评'
      const coach = this.coachById(coachId)
      this.assessments.push({
        id: uid('as'), bookingId, memberId: b.memberId, coachId, createdAt: nowStr(),
        ...payload, coachSignedAt: nowStr(),
      })
      this.log(b.memberId, '体验测评', 'coach', coach?.name ?? '', '完成体验课测评',
        `${payload.posture.slice(0, 60)}…；建议：${payload.recommendedPackage}；风险提示已签署。`, true)
      this.persist()
    },

    // ---------- 会员：确认购课 → 生成课包 + 排课计划 + 请假规则 + 续费提醒基线 ----------
    purchasePackage(memberId: string, coachId: string, name: string, totalSessions: number, validDays: number, slots: WeekdaySlot[], memberName: string) {
      const pkg: CoursePackage = {
        id: uid('pk'), memberId, coachId, name, totalSessions, usedSessions: 0,
        startDate: today(), expiryDate: addDays(today(), validDays), status: '进行中',
        leaveRule: { maxLeavePerMonth: 2, advanceHours: 12, note: '每月最多请假 2 次，需提前 12 小时；超出视同消课。' },
        extensionRule: {
          maxExtensions: 2, maxDaysPerTime: 14, maxDaysTotal: 30,
          note: '合同约定：课包有效期内最多书面申请延期 2 次，单次不超过 14 天，累计不超过 30 天；所有延期须经顾问申请并留档，口头承诺无效。',
        },
        extensions: [],
        createdAt: nowStr(),
      }
      this.packages.push(pkg)
      slots.forEach((s) => {
        this.plans.push({ id: uid('pl'), packageId: pkg.id, memberId, coachId, weekday: s.weekday, time: s.time, active: true })
      })
      // 按每周固定时段生成未来 3 周课程
      upcomingDates(today(), slots, slots.length * 3).forEach((d, i) => {
        this.sessions.push({
          id: uid('ss'), packageId: pkg.id, memberId, coachId, date: d.date, time: d.time,
          kind: '私教课', status: '待上课', focus: i === 0 ? '开课评估与目标对齐' : '待上节课反馈后确定', isExperience: false,
        })
      })
      const b = this.bookingOf(memberId)
      if (b && b.status === '已完成测评') b.status = '已购课'
      this.log(memberId, '购课', 'member', memberName, '确认购买课包',
        `${name}，共 ${totalSessions} 节，有效期至 ${pkg.expiryDate}；请假规则：每月最多 2 次、提前 12 小时。`)
      this.log(memberId, '排课', 'consultant', '系统', '生成排课计划',
        slotsText(slots) + '；课包剩余 4 节或到期前 21 天将自动提醒续费。')
      this.persist()
    },

    // ---------- 教练：课后记录 ----------
    completeSession(sessionId: string, payload: { completedMoves: string[]; memberFeel: number; feelNote: string; painChanges: PainChange[]; homePractice: string; coachNote: string; nextFocus?: string }, coachName: string) {
      const ss = this.sessions.find(x => x.id === sessionId)
      if (!ss || ss.status !== '待上课') return
      ss.status = '已完成'
      this.records.push({
        id: uid('rc'), sessionId, memberId: ss.memberId, coachId: ss.coachId, createdAt: nowStr(),
        completedMoves: payload.completedMoves, memberFeel: payload.memberFeel, feelNote: payload.feelNote,
        painChanges: payload.painChanges, homePractice: payload.homePractice, coachNote: payload.coachNote,
      })
      if (!ss.isExperience) {
        const pkg = this.packages.find(p => p.id === ss.packageId)
        if (pkg) pkg.usedSessions += 1
      }
      if (payload.nextFocus) {
        const next = this.sessions
          .filter(x => x.memberId === ss.memberId && x.status === '待上课' && (x.date + x.time) > (ss.date + ss.time))
          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0]
        if (next) next.focus = payload.nextFocus
      }
      const pain = payload.painChanges.map(p => `${p.part} ${p.before}→${p.after} 分`).join('，')
      this.log(ss.memberId, '上课记录', 'coach', coachName, `${ss.kind}完成`,
        `完成动作：${payload.completedMoves.join('、')}；体感 ${payload.memberFeel}/10${pain ? `；疼痛变化：${pain}` : ''}；家庭练习：${payload.homePractice}`, true)
      this.persist()
    },

    // ---------- 请假 ----------
    requestLeave(sessionId: string, byRole: 'member' | 'coach', byId: string, reason: string) {
      const ss = this.sessions.find(x => x.id === sessionId)
      if (!ss || ss.status !== '待上课') return
      let withinRule = true
      if (byRole === 'member') {
        const pkg = this.packages.find(p => p.id === ss.packageId)
        if (pkg) {
          const month = ss.date.slice(0, 7)
          const used = this.leaves.filter(l => l.byRole === 'member' && l.status === '已批准'
            && this.sessions.find(x => x.id === l.sessionId)?.date.slice(0, 7) === month
            && this.sessions.find(x => x.id === l.sessionId)?.memberId === ss.memberId).length
          const hoursAhead = (new Date(ss.date + 'T' + ss.time.slice(0, 5)).getTime() - Date.now()) / 3600000
          withinRule = used < pkg.leaveRule.maxLeavePerMonth && hoursAhead >= pkg.leaveRule.advanceHours
        }
      }
      this.leaves.unshift({ id: uid('lv'), sessionId, byRole, byId, reason, createdAt: nowStr(), status: '待处理', withinRule })
      const name = this.nameOf(byId)
      if (byRole === 'coach') {
        this.openTicket('教练请假', ss.memberId, `${name}教练请假`, `教练请假：${reason}。${ss.date} ${ss.time} 课程需要改期或换教练代课。`, ss.coachId, sessionId)
        this.log(ss.memberId, '请假', 'coach', name, '教练请假', `${ss.date} ${ss.time} 课程待协调：${reason}`)
      } else {
        this.log(ss.memberId, '请假', 'member', name, '会员请假申请', `${ss.date} ${ss.time}：${reason}${withinRule ? '' : '（超出请假规则，请顾问确认）'}`)
      }
      this.persist()
    },

    decideLeave(leaveId: string, approve: boolean, actorName: string) {
      const lv = this.leaves.find(l => l.id === leaveId)
      if (!lv || lv.status !== '待处理') return
      lv.status = approve ? '已批准' : '已拒绝'
      const ss = this.sessions.find(x => x.id === lv.sessionId)
      if (ss && approve) ss.status = lv.byRole === 'member' ? '会员请假' : '教练请假'
      if (ss) {
        this.log(ss.memberId, '请假', 'consultant', actorName, `请假${approve ? '已批准' : '已拒绝'}`,
          `${ss.date} ${ss.time}，${lv.byRole === 'member' ? '会员' : '教练'}请假：${lv.reason}${lv.withinRule ? '' : '（超出请假规则）'}`)
      }
      this.persist()
    },

    // ---------- 改期 ----------
    rescheduleSession(sessionId: string, newDate: string, newTime: string, actorRole: 'member' | 'consultant' | 'coach', actorName: string) {
      const ss = this.sessions.find(x => x.id === sessionId)
      // 允许对「待上课」以及「教练请假」的课程改期（教练请假后补课）
      if (!ss || (ss.status !== '待上课' && ss.status !== '教练请假')) return
      const old = `${ss.date}（${weekdayCn(ss.date)}）${ss.time}`
      const wasCoachLeave = ss.status === '教练请假'
      ss.date = newDate
      ss.time = newTime
      ss.status = '待上课'
      this.log(ss.memberId, '改期', actorRole, actorName, wasCoachLeave ? '教练请假课程补课改期' : '课程改期',
        `${old} → ${newDate}（${weekdayCn(newDate)}）${newTime}`)
      this.persist()
    },

    // ---------- 会员：不适上报 ----------
    reportDiscomfort(memberId: string, detail: string, memberName: string) {
      const pkg = this.activePackage(memberId)
      this.openTicket('会员不适', memberId, '会员身体不适上报', detail, pkg?.coachId)
      this.log(memberId, '不适上报', 'member', memberName, '上报身体不适', detail)
      this.persist()
    },

    // ---------- 教练：课程调整（专业记录） ----------
    adjustPlan(memberId: string, coachId: string, note: string, nextFocus: string | undefined, coachName: string) {
      this.log(memberId, '课程调整', 'coach', coachName, '调整训练计划', note, true)
      if (nextFocus) {
        const next = this.upcomingSessions(memberId)[0]
        if (next) next.focus = nextFocus
      }
      // 关联的不适工单推进为处理中
      const tk = this.tickets.find(t => t.memberId === memberId && t.type === '会员不适' && t.status !== '已解决')
      if (tk) tk.status = '处理中'
      this.persist()
    },

    // ---------- 会员：申请换教练 ----------
    requestCoachChange(memberId: string, reason: string, memberName: string) {
      const pkg = this.activePackage(memberId)
      this.openTicket('更换教练', memberId, '会员申请更换教练', reason, pkg?.coachId)
      this.log(memberId, '更换教练', 'member', memberName, '申请更换教练', reason)
      this.persist()
    },

    // ---------- 顾问：换教练（训练记录完整交接，不从零开始） ----------
    assignNewCoach(ticketId: string, newCoachId: string, consultantName: string) {
      const tk = this.tickets.find(t => t.id === ticketId)
      if (!tk || tk.type !== '更换教练') return
      const pkg = this.activePackage(tk.memberId)
      const oldCoach = pkg ? this.coachById(pkg.coachId)?.name : ''
      const nc = this.coachById(newCoachId)
      if (pkg) pkg.coachId = newCoachId
      this.plans.filter(p => p.memberId === tk.memberId && p.active).forEach(p => { p.coachId = newCoachId })
      this.sessions.filter(s => s.memberId === tk.memberId && s.status === '待上课').forEach(s => { s.coachId = newCoachId })
      tk.status = '已解决'
      tk.resolution = `已由${oldCoach}更换为${nc?.name}；历史测评、${this.recordsOf(tk.memberId).length} 条课后记录与疼痛趋势完整交接，新教练从既有计划继续。`
      this.log(tk.memberId, '更换教练', 'consultant', consultantName, '完成换教练',
        tk.resolution)
      this.persist()
    },

    // ---------- 顾问：工单处理 ----------
    resolveTicket(ticketId: string, resolution: string, consultantName: string) {
      const tk = this.tickets.find(t => t.id === ticketId)
      if (!tk) return
      tk.status = '已解决'
      tk.resolution = resolution
      this.log(tk.memberId, '工单处理', 'consultant', consultantName, `处理「${tk.title}」`, resolution)
      this.persist()
    },

    // ---------- 顾问：续费跟进（基于真实训练进度） ----------
    followUpRenewal(memberId: string, consultantId: string, summary: string, result: '跟进中' | '已续费' | '暂缓', consultantName: string, renew?: { name: string; totalSessions: number; validDays: number; slots: WeekdaySlot[] }) {
      this.renewals.unshift({ id: uid('rn'), memberId, consultantId, createdAt: nowStr(), summary, result })
      this.log(memberId, '续费', 'consultant', consultantName, '续费跟进', summary)
      if (result === '已续费' && renew) {
        const old = this.activePackage(memberId)
        if (old) old.status = '已续费衔接'
        this.purchasePackage(memberId, old?.coachId ?? '', renew.name, renew.totalSessions, renew.validDays, renew.slots, consultantName)
        // purchasePackage 内部已 persist
      }
      const tk = this.tickets.find(t => t.memberId === memberId && t.type === '课包到期' && t.status !== '已解决')
      if (tk && result !== '跟进中') { tk.status = '已解决'; tk.resolution = `续费跟进结果：${result}` }
      this.persist()
    },

    // ---------- 顾问：发起延期 / 调频率申请（书面留档，经审批才生效） ----------
    applyExtension(input: {
      packageId: string
      kind: '延期' | '调整频率' | '延期并调整频率'
      extendDays: number
      newSlots: WeekSlot[]
      reason: string
    }, consultantId: string, consultantName: string): { ok: boolean; error?: string; warning?: string } {
      const pkg = this.packages.find(p => p.id === input.packageId)
      if (!pkg) return { ok: false, error: '课包不存在' }
      if (pkg.status !== '进行中') return { ok: false, error: '课包非进行中，不能申请延期/调频率' }
      const info = this.extensionInfo(pkg)
      const r = pkg.extensionRule
      const changesFreq = input.kind === '调整频率' || input.kind === '延期并调整频率'
      const extendsExpiry = input.kind !== '调整频率'
      const days = extendsExpiry ? input.extendDays : 0

      if (!input.reason.trim()) return { ok: false, error: '请填写会员无法按期完成的原因（将写入课包记录）' }
      if (extendsExpiry) {
        if (!Number.isFinite(days) || days <= 0) return { ok: false, error: '请填写有效的延期天数' }
        if (days > r.maxDaysPerTime) return { ok: false, error: `单次延期不得超过 ${r.maxDaysPerTime} 天（合同规则）` }
        if (info.used >= r.maxExtensions) return { ok: false, error: `该课包已书面延期 ${info.used} 次，达到合同上限 ${r.maxExtensions} 次，不能继续承诺` }
        if (info.daysUsed + days > r.maxDaysTotal) return { ok: false, error: `累计延期将达 ${info.daysUsed + days} 天，超过合同上限 ${r.maxDaysTotal} 天` }
      }
      if (changesFreq && !input.newSlots.length) return { ok: false, error: '请选择调整后的上课频率' }
      if (this.extensionRequests.some(x => x.packageId === pkg.id && x.status === '待审批')) {
        return { ok: false, error: '该课包已有一笔待审批申请，请先完成审批' }
      }

      const oldSlots = this.slotsOf(pkg.id)
      const finalSlots = changesFreq ? input.newSlots : oldSlots
      const newExpiryDate = addDays(pkg.expiryDate, days)
      const remaining = pkg.totalSessions - pkg.usedSessions
      // 按新频率重排后，落在新有效期内的节数（与页面预览同一算法）
      const fitDates = upcomingDates(today(), finalSlots, remaining).filter(d => d.date <= newExpiryDate)
      const warning = remaining > fitDates.length
        ? `即使${extendsExpiry ? `延期 ${days} 天` : ''}${changesFreq ? '调整频率' : ''}，按新日历到期前仍只能排 ${fitDates.length} 节，剩余 ${remaining - fitDates.length} 节可能落在有效期外`
        : undefined

      const kindText = input.kind === '延期' ? `有效期顺延 ${days} 天`
        : input.kind === '调整频率' ? '上课频率调整（有效期不变）'
        : `有效期顺延 ${days} 天并调整上课频率`
      const seqText = extendsExpiry ? `（延期第 ${info.used + 1}/${r.maxExtensions} 次，累计 ${info.daysUsed + days}/${r.maxDaysTotal} 天）` : ''
      const freqText = changesFreq ? `频率由「${slotsText(oldSlots)}」调整为「${slotsText(finalSlots)}」；` : ''
      const promiseNote = `因${input.reason.trim()}，书面${kindText}${seqText}：${freqText}新有效期至 ${newExpiryDate}；审批通过后课包日历自动重排剩余课程。本承诺已写入课包记录，任何口头延期/改频均无效。`

      const req: ExtensionRequest = {
        id: uid('er'), packageId: pkg.id, memberId: pkg.memberId,
        consultantId, consultantName, createdAt: nowStr(),
        reason: input.reason.trim(), kind: input.kind, extendDays: days, newSlots: finalSlots,
        status: '待审批', reviewedAt: '', reviewerName: '', rejectReason: '', promiseNote,
      }
      this.extensionRequests.unshift(req)
      this.log(pkg.memberId, '延期', 'consultant', consultantName, `提交${input.kind}申请（待审批）`,
        `${kindText}${seqText}，原因：${input.reason.trim()}；${freqText}承诺内容将在审批通过后写入课包记录。`)
      this.persist()
      return { ok: true, warning }
    },

    // ---------- 审批：通过后改有效期/频率，并自动重排课包日历 ----------
    decideExtension(requestId: string, approve: boolean, reviewerName: string, rejectReason = '') {
      const req = this.extensionRequests.find(x => x.id === requestId)
      if (!req || req.status !== '待审批') return
      const pkg = this.packages.find(p => p.id === req.packageId)
      if (!pkg) { req.status = '已驳回'; req.rejectReason = '课包不存在'; return }

      if (!approve) {
        req.status = '已驳回'
        req.reviewedAt = nowStr()
        req.reviewerName = reviewerName
        req.rejectReason = rejectReason.trim() || '不符合延期/调频率条件'
        this.log(pkg.memberId, '延期', 'consultant', reviewerName, `${req.kind}申请已驳回`,
          `驳回原因：${req.rejectReason}；课包有效期与课表不变，继续按合同规则执行。`)
        this.persist()
        return
      }

      const info = this.extensionInfo(pkg)
      const oldExpiryDate = pkg.expiryDate
      const oldSlots = this.slotsOf(pkg.id)
      const changesFreq = req.kind === '调整频率' || req.kind === '延期并调整频率'
      const finalSlots = changesFreq ? req.newSlots : oldSlots

      // 1) 有效期顺延
      if (req.extendDays > 0) pkg.expiryDate = addDays(pkg.expiryDate, req.extendDays)

      // 2) 更换上课频率：停用旧排课计划，写入新计划
      if (changesFreq) {
        this.plans.filter(p => p.packageId === pkg.id && p.active).forEach(p => { p.active = false })
        finalSlots.forEach(s => {
          this.plans.push({ id: uid('pl'), packageId: pkg.id, memberId: pkg.memberId, coachId: pkg.coachId, weekday: s.weekday, time: s.time, active: true })
        })
      }

      // 3) 课包日历自动重排：剩余「待上课」按新频率/新有效期重新落位
      //    仅延期时保留仍在有效期内的原日期，超出有效期的课前移补位；调频率时整体重排
      const pending = this.sessions
        .filter(x => x.packageId === pkg.id && x.status === '待上课' && !x.isExperience && x.date >= today())
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      const laid = relayoutSessions(
        pending.map(s => ({ date: s.date, time: s.time })),
        finalSlots, pkg.expiryDate, !changesFreq,
      )
      let rescheduledCount = 0
      pending.forEach((s, i) => {
        if (laid[i].changed) {
          s.date = laid[i].date; s.time = laid[i].time; rescheduledCount += 1
        }
      })
      const outOfRange = laid.filter(x => x.outOfRange).length

      // 4) 书面承诺写入课包记录（防止口头延期争议）
      const ext: PackageExtension = {
        id: uid('ext'), packageId: pkg.id, appliedAt: nowStr(),
        consultantId: req.consultantId, consultantName: req.consultantName,
        reason: req.reason, kind: req.kind, extendDays: req.extendDays,
        oldExpiryDate, newExpiryDate: pkg.expiryDate,
        oldSlots, newSlots: changesFreq ? finalSlots : [],
        rescheduledCount, requestId: req.id, promiseNote: req.promiseNote,
      }
      pkg.extensions.push(ext)

      req.status = '已通过'
      req.reviewedAt = nowStr()
      req.reviewerName = reviewerName

      const pieces = [
        req.extendDays > 0 ? `有效期 ${oldExpiryDate} → ${pkg.expiryDate}（顺延 ${req.extendDays} 天，第 ${info.used + 1}/${pkg.extensionRule.maxExtensions} 次）` : '',
        changesFreq ? `频率「${slotsText(oldSlots)}」→「${slotsText(finalSlots)}」` : '',
        `日历自动重排 ${rescheduledCount} 节待上课` + (rescheduledCount === 0 ? '（顺延/调频后现有课程均有效，无需移动）' : ''),
      ].filter(Boolean)
      this.log(pkg.memberId, '延期', 'consultant', reviewerName, `${req.kind}申请通过${rescheduledCount > 0 ? '，课包日历已重排' : '，课包日历无需移动'}`,
        pieces.join('；') + (outOfRange ? `；另有 ${outOfRange} 节在新有效期内仍排不下，需顾问继续与会员沟通加频率或续费` : '')
        + '。承诺已写入课包记录，会员、教练、顾问可见同一份凭证；后续请假仍按合同规则执行，不再接受口头延期。')
      this.persist()
    },

    // ---------- 投诉 ----------
    addComplaint(memberId: string, content: string, memberName: string) {
      this.complaints.unshift({ id: uid('cp'), memberId, content, createdAt: nowStr(), status: '待处理', reply: '' })
      this.log(memberId, '投诉', 'member', memberName, '提交投诉', content)
      this.persist()
    },
    replyComplaint(id: string, reply: string, consultantName: string) {
      const c = this.complaints.find(x => x.id === id)
      if (!c) return
      c.status = '已回复'
      c.reply = reply
      this.log(c.memberId, '工单处理', 'consultant', consultantName, '回复投诉', reply)
      this.persist()
    },

    setSessionFocus(sessionId: string, focus: string) {
      const ss = this.sessions.find(x => x.id === sessionId)
      if (ss) { ss.focus = focus; this.persist() }
    },
  },
})
