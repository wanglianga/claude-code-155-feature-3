// ============================================================
// 领域模型：城市瑜伽馆私教全流程
// 会员 / 顾问 / 教练 三角色围绕「同一套训练记录」协作
// ============================================================

export type Role = 'member' | 'consultant' | 'coach'

export interface Account {
  id: string
  role: Role
  name: string
  password: string
  phone: string
}

// ---------------- 体验课预约（会员填写） ----------------
export type FitnessBase = '零基础' | '偶尔运动' | '规律运动' | '长期训练'
export type Flexibility = '很僵硬' | '偏僵硬' | '一般' | '较好'

export interface PainInfo {
  part: string          // 部位，如 膝盖/腰椎/肩颈
  level: number         // 0-10 疼痛等级
  note: string
}

export interface ExperienceBooking {
  id: string
  memberId: string
  createdAt: string
  fitnessBase: FitnessBase
  pains: PainInfo[]
  flexibility: Flexibility
  goals: string[]               // 减脂塑形/体态矫正/柔韧提升/康复舒缓/减压助眠
  goalNote: string
  availableSlots: string[]      // 可上课时间，如 ['周一 19:00-20:00']
  budget: string                // 预算区间
  mindOppositeGenderCoach: boolean  // 是否介意异性教练
  status: '待安排' | '已安排' | '已完成测评' | '已购课' | '已取消'
  note: string
}

// ---------------- 体验课测评（教练填写，专业档案，顾问只读） ----------------
export interface Assessment {
  id: string
  bookingId: string
  memberId: string
  coachId: string
  createdAt: string
  posture: string          // 体态评估
  movementLimits: string   // 动作限制
  courseAdvice: string     // 课程建议
  riskNotice: string       // 风险提示（医疗边界声明）
  recommendedPackage: string  // 推荐套餐
  coachSignedAt: string    // 教练签名确认时间（签名后内容锁定，顾问不可改）
}

// ---------------- 课包与排课 ----------------

/** 课包延期合同规则（所有承诺以书面记录为准，禁止无限口头延期） */
export interface ExtensionRule {
  maxExtensions: number   // 课包生命周期内最多延期次数
  maxDaysPerTime: number  // 单次最多延期天数
  maxDaysTotal: number    // 累计最多延期天数
  note: string            // 合同条款原文（页面直接展示）
}

/** 已生效的课包延期/频率调整（写入课包记录的书面承诺） */
export interface PackageExtension {
  id: string
  packageId: string
  appliedAt: string                  // 通过时间
  consultantId: string
  consultantName: string
  reason: string                     // 会员原因（如：工作原因无法按期完成）
  kind: '延期' | '调整频率' | '延期并调整频率'
  extendDays: number                 // 有效期顺延天数
  oldExpiryDate: string
  newExpiryDate: string
  oldSlots: WeekSlot[]               // 调整前上课频率
  newSlots: WeekSlot[]               // 调整后上课频率（kind 含频率调整时）
  rescheduledCount: number           // 自动重排的课程节数
  requestId: string                  // 关联的延期申请
  promiseNote: string                // 书面承诺摘要（防止口头争议）
}

/** 每周固定上课时段（排课计划的可序列化形态） */
export interface WeekSlot {
  weekday: number          // 0-6
  time: string             // '19:00-20:00'
}

/** 顾问发起的延期 / 调频率申请（通过后才生效） */
export interface ExtensionRequest {
  id: string
  packageId: string
  memberId: string
  consultantId: string
  consultantName: string
  createdAt: string
  reason: string                     // 会员无法按期完成的原因
  kind: '延期' | '调整频率' | '延期并调整频率'
  extendDays: number
  newSlots: WeekSlot[]               // 调频率后的目标频率（仅延期时与当前一致）
  status: '待审批' | '已通过' | '已驳回'
  reviewedAt: string
  reviewerName: string
  rejectReason: string
  promiseNote: string                // 通过后要写入课包的承诺内容
}

export interface CoursePackage {
  id: string
  memberId: string
  coachId: string
  name: string             // 如「私教 24 节 · 体态矫正」
  totalSessions: number
  usedSessions: number
  startDate: string
  expiryDate: string
  status: '进行中' | '已用完' | '已过期' | '已续费衔接'
  leaveRule: LeaveRule
  extensionRule: ExtensionRule
  extensions: PackageExtension[]     // 历次书面延期/调频率承诺
  createdAt: string
}

export interface LeaveRule {
  maxLeavePerMonth: number     // 每月最多请假次数
  advanceHours: number         // 需提前多少小时请假
  note: string
}

// 排课计划：每周固定时段
export interface SchedulePlan {
  id: string
  packageId: string
  memberId: string
  coachId: string
  weekday: number          // 0-6
  time: string             // '19:00-20:00'
  active: boolean
}

export type SessionStatus = '待上课' | '已完成' | '会员请假' | '教练请假' | '已改期' | '已取消'

export interface Session {
  id: string
  packageId: string
  memberId: string
  coachId: string
  date: string             // YYYY-MM-DD
  time: string
  kind: '体验课' | '私教课'
  status: SessionStatus
  focus: string            // 本节课重点（教练基于上节反馈制定）
  isExperience: boolean
  bookingId?: string
}

// ---------------- 课后训练记录（教练填写） ----------------
export interface PainChange {
  part: string
  before: number   // 课前 0-10
  after: number    // 课后 0-10
}

export interface SessionRecord {
  id: string
  sessionId: string
  memberId: string
  coachId: string
  createdAt: string
  completedMoves: string[]   // 完成动作
  memberFeel: number         // 会员体感 1-10（RPE）
  feelNote: string
  painChanges: PainChange[]  // 疼痛变化
  homePractice: string       // 家庭练习布置
  coachNote: string          // 教练备注（下节课依据）
}

// ---------------- 请假 ----------------
export interface LeaveRequest {
  id: string
  sessionId: string
  byRole: 'member' | 'coach'
  byId: string
  reason: string
  createdAt: string
  status: '待处理' | '已批准' | '已拒绝'
  withinRule: boolean        // 是否符合请假规则（提前时长/当月次数）
}

// ---------------- 异常工单（六类场景统一处理） ----------------
export type TicketType =
  | '会员不适'       // 如膝盖不适
  | '教练请假'
  | '临时改期'
  | '进度落后'
  | '更换教练'
  | '课包到期'

export interface Ticket {
  id: string
  type: TicketType
  memberId: string
  coachId?: string
  sessionId?: string
  title: string
  detail: string
  createdAt: string
  status: '待处理' | '处理中' | '已解决'
  resolution: string         // 处理结论（写回训练记录）
}

// ---------------- 续费 ----------------
export interface RenewalFollowUp {
  id: string
  memberId: string
  consultantId: string
  createdAt: string
  summary: string            // 顾问基于训练进度撰写的沟通纪要
  result: '跟进中' | '已续费' | '暂缓'
}

// ---------------- 投诉 ----------------
export interface Complaint {
  id: string
  memberId: string
  content: string
  createdAt: string
  status: '待处理' | '已回复' | '已关闭'
  reply: string
}

// ---------------- 统一训练时间线（三方共享的同一套记录） ----------------
export type TimelineKind =
  | '预约体验' | '安排体验' | '体验测评' | '购课' | '排课'
  | '上课记录' | '请假' | '改期' | '不适上报' | '课程调整'
  | '更换教练' | '续费' | '投诉' | '工单处理' | '延期'

export interface TimelineEvent {
  id: string
  memberId: string
  at: string
  kind: TimelineKind
  actorRole: Role
  actorName: string
  title: string
  detail: string
  professional?: boolean     // true = 教练专业记录，顾问端只读展示
}

// ---------------- 教练档案 ----------------
export interface CoachProfile {
  id: string
  name: string
  gender: '女' | '男'
  specialties: string[]      // 理疗瑜伽/体态矫正/力量流/阴瑜伽...
  bio: string
}
