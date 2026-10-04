import { defineStore } from 'pinia'
import type {
  Account, Assessment, CoachProfile, Complaint, CoursePackage, ExperienceBooking,
  ExtensionRequest, LeaveRequest, PackageCommitment, PainChange, RenewalFollowUp, Role, SchedulePlan,
  Session, SessionRecord, Ticket, TicketType, TimelineEvent, TimelineKind, WeekdaySlot,
} from '../types'
import { EXTENSION_POLICY } from '../types'
import { buildSeed, SEED_VERSION, type SeedState } from '../data/seed'
import { addDays, daysBetween, nextWeekday, nowStr, today, uid, weekdayCn, WEEKDAY_CN } from '../utils/date'

const KEY = `yoga_db_v${SEED_VERSION}`

export type { WeekdaySlot }

/** 延期规则校验结果 */
export interface ExtensionCheck {
  canApply: boolean
  timesLeft: number
  daysLeft: number
  blockReason: string
}

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

    // ---- 延期 / 承诺 ----
    commitmentsOf: (s) => (packageId: string) =>
      s.commitments.filter(c => c.packageId === packageId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

    extensionsOf: (s) => (memberId: string) =>
      s.extensions.filter(e => e.memberId === memberId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

    pendingExtensions: (s) => s.extensions.filter(e => e.status === '待审批'),

    /** 合同规则校验：延期次数 / 累计天数是否还有额度 */
    extensionCheck: () => (pkg: CoursePackage): ExtensionCheck => {
      const timesLeft = EXTENSION_POLICY.maxTimes - pkg.extensionCount
      const daysLeft = EXTENSION_POLICY.maxTotalDays - pkg.extensionDaysTotal
      let blockReason = ''
      if (timesLeft <= 0) blockReason = `已达合同延期上限（${EXTENSION_POLICY.maxTimes} 次），不得再延期；顾问不得口头承诺，请引导会员在到期前完成课程或办理续费衔接。`
      else if (daysLeft <= 0) blockReason = `累计延期已达 ${EXTENSION_POLICY.maxTotalDays} 天上限，不得再延期。`
      return { canApply: timesLeft > 0 && daysLeft > 0, timesLeft: Math.max(0, timesLeft), daysLeft: Math.max(0, daysLeft), blockReason }
    },

    /** 会员请假次数（按月） */
    memberLeavesOf: (s) => (memberId: string) =>
      s.leaves.filter(l => l.byRole === 'member'
        && s.sessions.find(x => x.id === l.sessionId)?.memberId === memberId),
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

    log(memberId: string, kind: TimelineKind, actorRole: Role, actorName: string, title: string, detail: string, professional = false) {
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
        extensionCount: 0, extensionDaysTotal: 0,
        createdAt: nowStr(),
      }
      this.packages.push(pkg)
      slots.forEach((s, i) => {
        this.plans.push({ id: uid('pl'), packageId: pkg.id, memberId, coachId, weekday: s.weekday, time: s.time, active: true })
        // 生成未来 3 周课程
        for (let w = 0; w < 3; w++) {
          const date = addDays(nextWeekday(today(), s.weekday), w * 7)
          this.sessions.push({
            id: uid('ss'), packageId: pkg.id, memberId, coachId, date, time: s.time,
            kind: '私教课', status: '待上课', focus: i === 0 && w === 0 ? '开课评估与目标对齐' : '待上节课反馈后确定', isExperience: false,
          })
        }
      })
      const b = this.bookingOf(memberId)
      if (b && b.status === '已完成测评') b.status = '已购课'
      this.log(memberId, '购课', 'member', memberName, '确认购买课包',
        `${name}，共 ${totalSessions} 节，有效期至 ${pkg.expiryDate}；请假规则：每月最多 2 次、提前 12 小时。`)
      this.log(memberId, '排课', 'consultant', '系统', '生成排课计划',
        slots.map(s => `每周${'日一二三四五六'[s.weekday]} ${s.time}`).join('、') + '；课包剩余 4 节或到期前 21 天将自动提醒续费。')
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
        if (old) {
          old.status = '已续费衔接'
          // 续费承诺落字：写入课包记录，会员/教练/顾问可见同一份
          this.commitments.unshift({
            id: uid('cm'), packageId: old.id, memberId, createdAt: nowStr(),
            actorRole: 'consultant', actorName: consultantName, kind: '续费',
            content: `会员确认续费：新课包「${renew.name}」${renew.totalSessions} 节，有效期 ${renew.validDays} 天，原课包剩余课时已衔接。`,
          })
        }
        this.purchasePackage(memberId, old?.coachId ?? '', renew.name, renew.totalSessions, renew.validDays, renew.slots, consultantName)
        // purchasePackage 内部已 persist
      }
      const tk = this.tickets.find(t => t.memberId === memberId && t.type === '课包到期' && t.status !== '已解决')
      if (tk && result !== '跟进中') { tk.status = '已解决'; tk.resolution = `续费跟进结果：${result}` }
      this.persist()
    },

    // ---------- 顾问：发起延期 / 调频申请（合同规则校验，口头承诺无效） ----------
    submitExtensionRequest(packageId: string, consultantId: string, consultantName: string, payload: { reason: string; extendDays: number; newSlots: WeekdaySlot[] }): ExtensionCheck {
      const pkg = this.packages.find(p => p.id === packageId)
      if (!pkg) return { canApply: false, timesLeft: 0, daysLeft: 0, blockReason: '课包不存在' }
      const check = this.extensionCheck(pkg)
      if (!check.canApply) return check
      if (payload.extendDays > 0) {
        if (payload.extendDays > EXTENSION_POLICY.maxDaysPerTime)
          return { ...check, canApply: false, blockReason: `单次延期不能超过 ${EXTENSION_POLICY.maxDaysPerTime} 天。` }
        if (payload.extendDays > check.daysLeft)
          return { ...check, canApply: false, blockReason: `累计延期不能超过 ${EXTENSION_POLICY.maxTotalDays} 天（剩余额度 ${check.daysLeft} 天）。` }
      }
      const req: ExtensionRequest = {
        id: uid('ex'), packageId, memberId: pkg.memberId, consultantId, consultantName,
        createdAt: nowStr(), reason: payload.reason, extendDays: payload.extendDays,
        newSlots: payload.newSlots, status: '待审批', decidedAt: '', decidedBy: '', decideNote: '',
      }
      this.extensions.unshift(req)
      const what = payload.extendDays > 0
        ? `延期 ${payload.extendDays} 天（至 ${addDays(pkg.expiryDate, payload.extendDays)}）`
        : '调整上课频率'
      const slots = payload.newSlots.length
        ? `；新频率：${payload.newSlots.map(s => `每周${WEEKDAY_CN[s.weekday].slice(1)} ${s.time}`).join('、')}`
        : ''
      this.log(pkg.memberId, '延期申请', 'consultant', consultantName, '发起延期/调频申请',
        `${what}${slots}。原因：${payload.reason}。提交店长审批，通过后自动重排课包日历并写入课包记录。`)
      this.persist()
      return check
    },

    // ---------- 店长：审批延期申请（通过后自动重排剩余课程） ----------
    decideExtension(requestId: string, approve: boolean, decideNote: string, managerName: string) {
      const req = this.extensions.find(e => e.id === requestId)
      if (!req || req.status !== '待审批') return
      const pkg = this.packages.find(p => p.id === req.packageId)
      req.status = approve ? '已通过' : '已拒绝'
      req.decidedAt = nowStr()
      req.decidedBy = managerName
      req.decideNote = decideNote
      if (!approve) {
        this.log(req.memberId, '延期审批', 'manager', managerName, '延期申请被拒绝',
          `原因：${decideNote || '未填写'}。顾问与会员需按原到期日 ${pkg?.expiryDate ?? ''} 安排剩余课程。`)
        this.persist()
        return
      }
      if (!pkg) return
      // 1) 更新课包有效期与延期计数
      const oldExpiry = pkg.expiryDate
      if (req.extendDays > 0) {
        pkg.expiryDate = addDays(pkg.expiryDate, req.extendDays)
        pkg.extensionCount += 1
        pkg.extensionDaysTotal += req.extendDays
      }
      // 2) 调整上课频率：停用旧计划，建立新计划
      if (req.newSlots.length) {
        this.plans.filter(p => p.packageId === pkg.id && p.active).forEach(p => { p.active = false })
        req.newSlots.forEach(s => this.plans.push({ id: uid('pl'), packageId: pkg.id, memberId: pkg.memberId, coachId: pkg.coachId, weekday: s.weekday, time: s.time, active: true }))
      }
      // 3) 自动重排剩余课程
      const scheduled = this.reschedulePackageSessions(pkg)
      // 4) 承诺写入课包记录（防止口头延期争议）
      const parts: string[] = []
      if (req.extendDays > 0) parts.push(`课包有效期延长 ${req.extendDays} 天：${oldExpiry} → ${pkg.expiryDate}（第 ${pkg.extensionCount}/${EXTENSION_POLICY.maxTimes} 次延期，累计 ${pkg.extensionDaysTotal} 天）`)
      if (req.newSlots.length) parts.push(`上课频率调整为 ${req.newSlots.map(s => `每周${WEEKDAY_CN[s.weekday].slice(1)} ${s.time}`).join('、')}`)
      parts.push(`剩余 ${pkg.totalSessions - pkg.usedSessions} 节已自动重排（${scheduled} 节排入新日历）`)
      const content = parts.join('；') + '。'
      this.commitments.unshift({
        id: uid('cm'), packageId: pkg.id, memberId: pkg.memberId, createdAt: nowStr(),
        actorRole: 'manager', actorName: managerName, kind: req.extendDays > 0 ? '延期' : '调频', content,
      })
      this.log(pkg.memberId, '延期审批', 'manager', managerName, '延期申请已通过',
        `${content}${decideNote ? ` 审批意见：${decideNote}` : ''} 承诺已写入课包记录。`)
      // 5) 关联的「课包到期」工单自动办结
      const tk = this.tickets.find(t => t.memberId === pkg.memberId && t.type === '课包到期' && t.status !== '已解决')
      if (tk) { tk.status = '已解决'; tk.resolution = `延期申请已通过：${content}` }
      this.persist()
    },

    /** 自动重排：清除该课包未来待上课，按（新）频率从明天起把剩余课时排入有效期内的日历 */
    reschedulePackageSessions(pkg: CoursePackage): number {
      const remaining = pkg.totalSessions - pkg.usedSessions
      // 保留原待上课的重点描述，按顺序带给新课
      const oldFocus = this.sessions
        .filter(s => s.packageId === pkg.id && s.status === '待上课' && s.date >= today())
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .map(s => s.focus)
      this.sessions = this.sessions.filter(s => !(s.packageId === pkg.id && s.status === '待上课' && s.date >= today()))
      const slots = this.plans
        .filter(p => p.packageId === pkg.id && p.active)
        .map(p => ({ weekday: p.weekday, time: p.time }))
        .sort((a, b) => a.weekday - b.weekday)
      if (!slots.length || remaining <= 0) return 0
      let added = 0
      let date = addDays(today(), 1)
      // 从明天起逐日扫描，命中固定时段且未超有效期则排课
      while (added < remaining && date <= pkg.expiryDate) {
        const slot = slots.find(s => s.weekday === new Date(date + 'T00:00:00').getDay())
        if (slot) {
          this.sessions.push({
            id: uid('ss'), packageId: pkg.id, memberId: pkg.memberId, coachId: pkg.coachId,
            date, time: slot.time, kind: '私教课', status: '待上课',
            focus: oldFocus[added] ?? '待上节课反馈后确定', isExperience: false,
          })
          added += 1
        }
        date = addDays(date, 1)
      }
      return added
    },

    // ---------- 顾问：手动记录沟通承诺（所有承诺写入课包记录） ----------
    addCommitment(packageId: string, actorRole: 'consultant' | 'manager', actorName: string, content: string) {
      const pkg = this.packages.find(p => p.id === packageId)
      if (!pkg) return
      this.commitments.unshift({
        id: uid('cm'), packageId, memberId: pkg.memberId, createdAt: nowStr(),
        actorRole, actorName, kind: '沟通承诺', content,
      })
      this.log(pkg.memberId, '承诺记录', actorRole, actorName, '沟通承诺写入课包记录', content)
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
