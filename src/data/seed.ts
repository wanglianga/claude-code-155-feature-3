import type {
  Account, Assessment, CoachProfile, Complaint, CoursePackage, ExperienceBooking,
  ExtensionRequest, LeaveRequest, PackageCommitment, RenewalFollowUp, SchedulePlan, Session,
  SessionRecord, Ticket, TimelineEvent,
} from '../types'
import { addDays, daysAgo, nowStr, today, weekdayCn } from '../utils/date'

export interface SeedState {
  accounts: Account[]
  coaches: CoachProfile[]
  bookings: ExperienceBooking[]
  assessments: Assessment[]
  packages: CoursePackage[]
  plans: SchedulePlan[]
  sessions: Session[]
  records: SessionRecord[]
  leaves: LeaveRequest[]
  tickets: Ticket[]
  renewals: RenewalFollowUp[]
  extensions: ExtensionRequest[]
  commitments: PackageCommitment[]
  complaints: Complaint[]
  timeline: TimelineEvent[]
}

// 固定 ID，便于测试账号与演示脚本引用
export const IDS = {
  consultant: 'u_consult_chen',
  manager: 'u_manager_wang',
  coachLin: 'u_coach_lin',
  coachZhou: 'u_coach_zhou',
  coachSu: 'u_coach_su',
  mWang: 'u_mem_wang',   // 王晓彤：膝盖不适 + 进度落后 + 本周有课（课包已延期 1 次）
  mLi: 'u_mem_li',       // 李敏：已预约体验课待安排
  mZhang: 'u_mem_zhang', // 张倩：体验测评已完成待购课
  mZhao: 'u_mem_zhao',   // 赵磊：课包 14 天后到期、剩 3 节 → 续费/延期
  mSun: 'u_mem_sun',     // 孙悦：申请换教练
  mHe: 'u_mem_he',       // 何静：投诉 + 教练请假受影响（课包已延期 2 次达上限）
}

export function buildSeed(): SeedState {
  const t = today()

  const accounts: Account[] = [
    { id: IDS.consultant, role: 'consultant', name: '陈曦', password: '123456', phone: '13800000001' },
    { id: IDS.manager, role: 'manager', name: '王店长', password: '123456', phone: '13800000009' },
    { id: IDS.coachLin, role: 'coach', name: '林岚', password: '123456', phone: '13800000002' },
    { id: IDS.coachZhou, role: 'coach', name: '周远', password: '123456', phone: '13800000003' },
    { id: IDS.coachSu, role: 'coach', name: '苏晴', password: '123456', phone: '13800000004' },
    { id: IDS.mWang, role: 'member', name: '王晓彤', password: '123456', phone: '13900000001' },
    { id: IDS.mLi, role: 'member', name: '李敏', password: '123456', phone: '13900000002' },
    { id: IDS.mZhang, role: 'member', name: '张倩', password: '123456', phone: '13900000003' },
    { id: IDS.mZhao, role: 'member', name: '赵磊', password: '123456', phone: '13900000004' },
    { id: IDS.mSun, role: 'member', name: '孙悦', password: '123456', phone: '13900000005' },
    { id: IDS.mHe, role: 'member', name: '何静', password: '123456', phone: '13900000006' },
  ]

  const coaches: CoachProfile[] = [
    { id: IDS.coachLin, name: '林岚', gender: '女', specialties: ['理疗瑜伽', '体态矫正', '膝关节养护'], bio: '8 年私教经验，擅长疼痛人群的安全练习编排。' },
    { id: IDS.coachZhou, name: '周远', gender: '男', specialties: ['力量流', '阿斯汤加', '减脂塑形'], bio: '前体能训练师，课程强度偏高，目标导向。' },
    { id: IDS.coachSu, name: '苏晴', gender: '女', specialties: ['阴瑜伽', '脊柱保养', '减压助眠'], bio: '注重呼吸与正念，适合高压人群与初学者。' },
  ]

  // ---------- 体验课预约 ----------
  const bookings: ExperienceBooking[] = [
    {
      id: 'bk_li', memberId: IDS.mLi, createdAt: daysAgo(1),
      fitnessBase: '偶尔运动',
      pains: [{ part: '肩颈', level: 4, note: '长期伏案，下午发紧' }],
      flexibility: '偏僵硬',
      goals: ['体态矫正', '减压助眠'], goalNote: '圆肩明显，想改善体态，顺便睡得好一点',
      availableSlots: ['周二 19:00-20:00', '周四 19:00-20:00', '周六 10:00-11:00'],
      budget: '400-600 元/节',
      mindOppositeGenderCoach: true,
      status: '待安排', note: '希望先体验再决定',
    },
    {
      id: 'bk_zhang', memberId: IDS.mZhang, createdAt: daysAgo(9),
      fitnessBase: '零基础',
      pains: [{ part: '腰椎', level: 3, note: '久坐后腰酸' }],
      flexibility: '很僵硬',
      goals: ['柔韧提升', '康复舒缓'], goalNote: '身体太硬了，想循序渐进',
      availableSlots: ['周一 19:00-20:00', '周三 19:00-20:00'],
      budget: '300-500 元/节',
      mindOppositeGenderCoach: true,
      status: '已完成测评', note: '',
    },
    {
      id: 'bk_wang', memberId: IDS.mWang, createdAt: daysAgo(50),
      fitnessBase: '规律运动',
      pains: [{ part: '右膝', level: 5, note: '跑步后右膝外侧疼痛，上下楼明显' }],
      flexibility: '一般',
      goals: ['康复舒缓', '减脂塑形'], goalNote: '想恢复跑步，先解决膝盖',
      availableSlots: ['周二 19:00-20:00', '周五 19:00-20:00'],
      budget: '500-700 元/节',
      mindOppositeGenderCoach: false,
      status: '已购课', note: '',
    },
  ]

  // ---------- 体验测评（教练专业档案） ----------
  const assessments: Assessment[] = [
    {
      id: 'as_zhang', bookingId: 'bk_zhang', memberId: IDS.mZhang, coachId: IDS.coachSu,
      createdAt: daysAgo(6),
      posture: '骨盆轻度前倾，腰椎生理曲度偏大；胸椎活动度不足，前屈手尖离地 18cm。',
      movementLimits: '避免深度后弯与长时间坐立前屈；犁式、轮式暂不建议。',
      courseAdvice: '以阴瑜伽+脊柱保养为主，每周 1-2 节，先建立髋部与胸椎灵活性，8 周后复测前屈。',
      riskNotice: '腰部不适为慢性劳损表现，若出现下肢放射痛或麻木，请立即停止练习并就医；课程不能替代医疗诊断。',
      recommendedPackage: '私教 16 节 · 脊柱保养（有效期 90 天）',
      coachSignedAt: daysAgo(6),
    },
    {
      id: 'as_wang', bookingId: 'bk_wang', memberId: IDS.mWang, coachId: IDS.coachLin,
      createdAt: daysAgo(46),
      posture: '髂胫束紧张，右膝 Q 角偏大，深蹲时右膝内扣；核心稳定性中等。',
      movementLimits: '避免跑跳类冲击与深度屈膝（>90°）体式；莲花式、英雄卧暂缓。',
      courseAdvice: '理疗瑜伽+膝关节养护，每周 2 节，强化臀中肌与股四头肌离心力量，配合髂胫束松解。',
      riskNotice: '右膝疼痛若持续加重或出现肿胀、交锁，请优先就诊运动医学科；训练强度以次日无不适为上限。',
      recommendedPackage: '私教 24 节 · 膝关节养护（有效期 120 天）',
      coachSignedAt: daysAgo(46),
    },
  ]

  // ---------- 课包 ----------
  const packages: CoursePackage[] = [
    {
      id: 'pk_wang', memberId: IDS.mWang, coachId: IDS.coachLin,
      name: '私教 24 节 · 膝关节养护', totalSessions: 24, usedSessions: 6,
      startDate: daysAgo(45), expiryDate: addDays(daysAgo(45), 120),
      status: '进行中',
      leaveRule: { maxLeavePerMonth: 2, advanceHours: 12, note: '每月最多请假 2 次，需提前 12 小时；超出视同消课。' },
      extensionCount: 1, extensionDaysTotal: 14,   // 已延期 1 次（膝痛恢复期），演示请假时的延期次数提示
      createdAt: daysAgo(45),
    },
    {
      id: 'pk_zhao', memberId: IDS.mZhao, coachId: IDS.coachZhou,
      name: '私教 12 节 · 减脂塑形', totalSessions: 12, usedSessions: 9,
      startDate: daysAgo(80), expiryDate: addDays(t, 14),   // 剩 3 节、两周后到期 → 本题主演示场景
      status: '进行中',
      leaveRule: { maxLeavePerMonth: 2, advanceHours: 12, note: '每月最多请假 2 次，需提前 12 小时。' },
      extensionCount: 0, extensionDaysTotal: 0,
      createdAt: daysAgo(80),
    },
    {
      id: 'pk_sun', memberId: IDS.mSun, coachId: IDS.coachZhou,
      name: '私教 24 节 · 力量提升', totalSessions: 24, usedSessions: 3,
      startDate: daysAgo(20), expiryDate: addDays(daysAgo(20), 120),
      status: '进行中',
      leaveRule: { maxLeavePerMonth: 2, advanceHours: 12, note: '每月最多请假 2 次，需提前 12 小时。' },
      extensionCount: 0, extensionDaysTotal: 0,
      createdAt: daysAgo(20),
    },
    {
      id: 'pk_he', memberId: IDS.mHe, coachId: IDS.coachZhou,
      name: '私教 12 节 · 减脂塑形', totalSessions: 12, usedSessions: 2,
      startDate: daysAgo(14), expiryDate: addDays(daysAgo(14), 90),
      status: '进行中',
      leaveRule: { maxLeavePerMonth: 2, advanceHours: 12, note: '每月最多请假 2 次，需提前 12 小时。' },
      extensionCount: 2, extensionDaysTotal: 30,   // 已达合同延期上限，演示「不能无限口头承诺」的拦截
      createdAt: daysAgo(14),
    },
  ]

  // ---------- 排课计划 ----------
  const plans: SchedulePlan[] = [
    { id: 'pl_wang', packageId: 'pk_wang', memberId: IDS.mWang, coachId: IDS.coachLin, weekday: 2, time: '19:00-20:00', active: true },
    { id: 'pl_wang2', packageId: 'pk_wang', memberId: IDS.mWang, coachId: IDS.coachLin, weekday: 5, time: '19:00-20:00', active: true },
    { id: 'pl_zhao', packageId: 'pk_zhao', memberId: IDS.mZhao, coachId: IDS.coachZhou, weekday: 1, time: '19:00-20:00', active: true },
    { id: 'pl_sun', packageId: 'pk_sun', memberId: IDS.mSun, coachId: IDS.coachZhou, weekday: 3, time: '20:00-21:00', active: true },
    { id: 'pl_he', packageId: 'pk_he', memberId: IDS.mHe, coachId: IDS.coachZhou, weekday: 4, time: '19:00-20:00', active: true },
  ]

  // ---------- 课程 ----------
  const sessions: Session[] = [
    // 王晓彤：体验课 + 6 节已上 + 1 次请假 + 1 次改期 + 未来 2 节
    { id: 'ss_wang_exp', packageId: 'pk_wang', memberId: IDS.mWang, coachId: IDS.coachLin, date: daysAgo(46), time: '19:00-20:00', kind: '体验课', status: '已完成', focus: '体态评估与基础筛查', isExperience: true, bookingId: 'bk_wang' },
    { id: 'ss_wang_1', packageId: 'pk_wang', memberId: IDS.mWang, coachId: IDS.coachLin, date: daysAgo(42), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '髂胫束松解 + 臀中肌激活', isExperience: false },
    { id: 'ss_wang_2', packageId: 'pk_wang', memberId: IDS.mWang, coachId: IDS.coachLin, date: daysAgo(38), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '股四头肌离心力量入门', isExperience: false },
    { id: 'ss_wang_3', packageId: 'pk_wang', memberId: IDS.mWang, coachId: IDS.coachLin, date: daysAgo(31), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '单腿稳定训练 + 核心', isExperience: false },
    { id: 'ss_wang_leave', packageId: 'pk_wang', memberId: IDS.mWang, coachId: IDS.coachLin, date: daysAgo(28), time: '19:00-20:00', kind: '私教课', status: '会员请假', focus: '髋部灵活性', isExperience: false },
    { id: 'ss_wang_4', packageId: 'pk_wang', memberId: IDS.mWang, coachId: IDS.coachLin, date: daysAgo(24), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '步态再教育 + 平衡', isExperience: false },
    { id: 'ss_wang_5', packageId: 'pk_wang', memberId: IDS.mWang, coachId: IDS.coachLin, date: daysAgo(17), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '下肢力线纠正', isExperience: false },
    { id: 'ss_wang_6', packageId: 'pk_wang', memberId: IDS.mWang, coachId: IDS.coachLin, date: daysAgo(10), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '低冲击有氧 + 膝关节养护', isExperience: false },
    { id: 'ss_wang_next1', packageId: 'pk_wang', memberId: IDS.mWang, coachId: IDS.coachLin, date: addDays(t, 2), time: '19:00-20:00', kind: '私教课', status: '待上课', focus: '膝关节减负版序列（理疗调整后首课）', isExperience: false },
    { id: 'ss_wang_next2', packageId: 'pk_wang', memberId: IDS.mWang, coachId: IDS.coachLin, date: addDays(t, 5), time: '19:00-20:00', kind: '私教课', status: '待上课', focus: '待上节课反馈后确定', isExperience: false },
    // 赵磊：9 节已上 + 2 节待上（课包 10 天后到期，剩 3 节）
    { id: 'ss_zhao_1', packageId: 'pk_zhao', memberId: IDS.mZhao, coachId: IDS.coachZhou, date: daysAgo(75), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '体测 + 基础力量评估', isExperience: false },
    { id: 'ss_zhao_2', packageId: 'pk_zhao', memberId: IDS.mZhao, coachId: IDS.coachZhou, date: daysAgo(68), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '上肢推拉力量', isExperience: false },
    { id: 'ss_zhao_3', packageId: 'pk_zhao', memberId: IDS.mZhao, coachId: IDS.coachZhou, date: daysAgo(61), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '下肢力量 + 核心', isExperience: false },
    { id: 'ss_zhao_4', packageId: 'pk_zhao', memberId: IDS.mZhao, coachId: IDS.coachZhou, date: daysAgo(54), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '力量流串联 A', isExperience: false },
    { id: 'ss_zhao_5', packageId: 'pk_zhao', memberId: IDS.mZhao, coachId: IDS.coachZhou, date: daysAgo(47), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '力量流串联 B', isExperience: false },
    { id: 'ss_zhao_6', packageId: 'pk_zhao', memberId: IDS.mZhao, coachId: IDS.coachZhou, date: daysAgo(40), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '间歇燃脂', isExperience: false },
    { id: 'ss_zhao_7', packageId: 'pk_zhao', memberId: IDS.mZhao, coachId: IDS.coachZhou, date: daysAgo(33), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '上肢力量进阶', isExperience: false },
    { id: 'ss_zhao_8', packageId: 'pk_zhao', memberId: IDS.mZhao, coachId: IDS.coachZhou, date: daysAgo(26), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '下肢力量进阶', isExperience: false },
    { id: 'ss_zhao_9', packageId: 'pk_zhao', memberId: IDS.mZhao, coachId: IDS.coachZhou, date: daysAgo(19), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '全身循环 + 体测对比', isExperience: false },
    { id: 'ss_zhao_n1', packageId: 'pk_zhao', memberId: IDS.mZhao, coachId: IDS.coachZhou, date: addDays(t, 3), time: '19:00-20:00', kind: '私教课', status: '待上课', focus: '上肢力量保持 + 体成分复测', isExperience: false },
    { id: 'ss_zhao_n2', packageId: 'pk_zhao', memberId: IDS.mZhao, coachId: IDS.coachZhou, date: addDays(t, 8), time: '19:00-20:00', kind: '私教课', status: '待上课', focus: '待上节课反馈后确定', isExperience: false },
    // 孙悦：3 节已上 + 2 节待上（申请换教练中）
    { id: 'ss_sun_1', packageId: 'pk_sun', memberId: IDS.mSun, coachId: IDS.coachZhou, date: daysAgo(18), time: '20:00-21:00', kind: '私教课', status: '已完成', focus: '力量基础评估', isExperience: false },
    { id: 'ss_sun_2', packageId: 'pk_sun', memberId: IDS.mSun, coachId: IDS.coachZhou, date: daysAgo(11), time: '20:00-21:00', kind: '私教课', status: '已完成', focus: '深蹲模式建立', isExperience: false },
    { id: 'ss_sun_3', packageId: 'pk_sun', memberId: IDS.mSun, coachId: IDS.coachZhou, date: daysAgo(4), time: '20:00-21:00', kind: '私教课', status: '已完成', focus: '上肢拉力入门', isExperience: false },
    { id: 'ss_sun_n1', packageId: 'pk_sun', memberId: IDS.mSun, coachId: IDS.coachZhou, date: addDays(t, 3), time: '20:00-21:00', kind: '私教课', status: '待上课', focus: '待换教练处理结果确定', isExperience: false },
    { id: 'ss_sun_n2', packageId: 'pk_sun', memberId: IDS.mSun, coachId: IDS.coachZhou, date: addDays(t, 10), time: '20:00-21:00', kind: '私教课', status: '待上课', focus: '待换教练处理结果确定', isExperience: false },
    // 何静：2 节已上 + 2 节待上（其中一节遇教练请假）
    { id: 'ss_he_1', packageId: 'pk_he', memberId: IDS.mHe, coachId: IDS.coachZhou, date: daysAgo(12), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '体态评估 + 呼吸建立', isExperience: false },
    { id: 'ss_he_2', packageId: 'pk_he', memberId: IDS.mHe, coachId: IDS.coachZhou, date: daysAgo(5), time: '19:00-20:00', kind: '私教课', status: '已完成', focus: '核心激活 + 低冲击燃脂', isExperience: false },
    { id: 'ss_he_n1', packageId: 'pk_he', memberId: IDS.mHe, coachId: IDS.coachZhou, date: addDays(t, 4), time: '19:00-20:00', kind: '私教课', status: '待上课', focus: '全身循环入门', isExperience: false },
    { id: 'ss_he_n2', packageId: 'pk_he', memberId: IDS.mHe, coachId: IDS.coachZhou, date: addDays(t, 11), time: '19:00-20:00', kind: '私教课', status: '待上课', focus: '待上节课反馈后确定', isExperience: false },
    // 张倩：体验课已完成
    { id: 'ss_zhang_exp', packageId: '', memberId: IDS.mZhang, coachId: IDS.coachSu, date: daysAgo(6), time: '19:00-20:00', kind: '体验课', status: '已完成', focus: '体态评估与基础筛查', isExperience: true, bookingId: 'bk_zhang' },
  ]

  // ---------- 课后训练记录 ----------
  const records: SessionRecord[] = [
    { id: 'rc_w1', sessionId: 'ss_wang_1', memberId: IDS.mWang, coachId: IDS.coachLin, createdAt: daysAgo(42), completedMoves: ['泡沫轴髂胫束松解', '蚌式开合 3×15', '臀桥 3×12', '婴儿式放松'], memberFeel: 5, feelNote: '松解时酸胀明显，可忍受', painChanges: [{ part: '右膝', before: 6, after: 5 }], homePractice: '每天蚌式开合 2 组，泡沫轴外侧腿 3 分钟', coachNote: '臀中肌力量偏弱，先不上负重。' },
    { id: 'rc_w2', sessionId: 'ss_wang_2', memberId: IDS.mWang, coachId: IDS.coachLin, createdAt: daysAgo(38), completedMoves: ['靠墙静蹲 3×30s', '坐姿腿屈伸（轻）3×12', '鸟狗式 3×10'], memberFeel: 6, feelNote: '静蹲时膝盖前侧轻微不适', painChanges: [{ part: '右膝', before: 5, after: 5 }], homePractice: '靠墙静蹲每天 2 组，注意膝盖不超过脚尖', coachNote: '屈膝角度控制在 60° 内，下次继续观察。' },
    { id: 'rc_w3', sessionId: 'ss_wang_3', memberId: IDS.mWang, coachId: IDS.coachLin, createdAt: daysAgo(31), completedMoves: ['单腿站立平衡 3×30s', '侧向弓步（浅）3×8', '死虫式 3×10'], memberFeel: 6, feelNote: '单腿动作右侧晃得厉害', painChanges: [{ part: '右膝', before: 5, after: 4 }], homePractice: '扶墙单腿站立每天 1 分钟×3', coachNote: '稳定性在进步，疼痛首次下降。' },
    { id: 'rc_w4', sessionId: 'ss_wang_4', memberId: IDS.mWang, coachId: IDS.coachLin, createdAt: daysAgo(24), completedMoves: ['步态分解练习', '平衡垫站立 3×30s', '臀桥进阶（单腿）3×8'], memberFeel: 7, feelNote: '单腿臀桥右侧吃力', painChanges: [{ part: '右膝', before: 4, after: 4 }], homePractice: '注意走路时膝盖对准第二脚趾', coachNote: '请假一周后状态保持得不错。' },
    { id: 'rc_w5', sessionId: 'ss_wang_5', memberId: IDS.mWang, coachId: IDS.coachLin, createdAt: daysAgo(17), completedMoves: ['弹力带侧走 3×10', '台阶下放（离心）3×8', '髂腰肌拉伸'], memberFeel: 6, feelNote: '台阶下放可控，膝盖没刺痛', painChanges: [{ part: '右膝', before: 4, after: 3 }], homePractice: '弹力带侧走每天 2 组', coachNote: '离心控制进步明显，疼痛降到 3 分。' },
    { id: 'rc_w6', sessionId: 'ss_wang_6', memberId: IDS.mWang, coachId: IDS.coachLin, createdAt: daysAgo(10), completedMoves: ['椭圆机低阻 10 分钟', '靠墙静蹲进阶 3×40s', '战士二（浅）', '仰卧扭转放松'], memberFeel: 8, feelNote: '课后第二天膝盖外侧又疼了，上下楼明显', painChanges: [{ part: '右膝', before: 3, after: 5 }], homePractice: '暂停静蹲，改为直腿抬高 2 组', coachNote: '强度加急了，疼痛反复到 5 分。下节课必须降强度，回到养护序列。' },
    { id: 'rc_z9', sessionId: 'ss_zhao_9', memberId: IDS.mZhao, coachId: IDS.coachZhou, createdAt: daysAgo(19), completedMoves: ['波比跳 4×10', '壶铃摆动 4×15', '俯卧撑 4×12', '平板支撑 3×45s'], memberFeel: 8, feelNote: '体能比第一节课好太多', painChanges: [], homePractice: '每天平板支撑 1 分钟', coachNote: '体脂降 2.1%，目标达成 70%，续课可进力量周期。' },
    { id: 'rc_s3', sessionId: 'ss_sun_3', memberId: IDS.mSun, coachId: IDS.coachZhou, createdAt: daysAgo(4), completedMoves: ['高位下拉 3×12', '划船 3×12', '面拉 3×15'], memberFeel: 7, feelNote: '强度偏大，沟通节奏不太适应', painChanges: [], homePractice: '弹力带面拉每天 2 组', coachNote: '会员反馈节奏偏快，已收到换教练申请，配合交接。' },
    { id: 'rc_h2', sessionId: 'ss_he_2', memberId: IDS.mHe, coachId: IDS.coachZhou, createdAt: daysAgo(5), completedMoves: ['死虫式 3×10', '臀桥 3×12', '登山跑 3×20s'], memberFeel: 6, feelNote: '核心很弱但跟得上', painChanges: [], homePractice: '死虫式每天 2 组', coachNote: '先打核心基础，暂不上大强度间歇。' },
    { id: 'rc_zhang_exp', sessionId: 'ss_zhang_exp', memberId: IDS.mZhang, coachId: IDS.coachSu, createdAt: daysAgo(6), completedMoves: ['体态评估', '猫牛式', '婴儿式', '仰卧脊柱扭转'], memberFeel: 4, feelNote: '很温和，第一次练完很舒服', painChanges: [{ part: '腰椎', before: 3, after: 2 }], homePractice: '每天猫牛式 10 次', coachNote: '零基础但本体感觉不错，适合阴瑜伽入门。' },
  ]

  // ---------- 请假 ----------
  const leaves: LeaveRequest[] = [
    { id: 'lv_wang', sessionId: 'ss_wang_leave', byRole: 'member', byId: IDS.mWang, reason: '临时出差，赶不上课', createdAt: daysAgo(29), status: '已批准', withinRule: true },
    { id: 'lv_zhou', sessionId: 'ss_he_n1', byRole: 'coach', byId: IDS.coachZhou, reason: '家中有事，周四全天请假', createdAt: daysAgo(1), status: '待处理', withinRule: true },
  ]

  // ---------- 异常工单 ----------
  const tickets: Ticket[] = [
    { id: 'tk_knee', type: '会员不适', memberId: IDS.mWang, coachId: IDS.coachLin, title: '右膝疼痛反复', detail: '会员反馈：上节课后第二天右膝外侧疼痛回到 5 分，上下楼明显，希望调整训练强度。', createdAt: daysAgo(9), status: '处理中', resolution: '' },
    { id: 'tk_progress', type: '进度落后', memberId: IDS.mWang, coachId: IDS.coachLin, title: '课消进度落后', detail: '课包已过半程，24 节仅消耗 6 节（含 1 次请假），按当前频率到期前无法上完。', createdAt: daysAgo(3), status: '待处理', resolution: '' },
    { id: 'tk_coach_leave', type: '教练请假', memberId: IDS.mHe, coachId: IDS.coachZhou, sessionId: 'ss_he_n1', title: '周远教练周四请假', detail: '教练请假 1 天，何静周四 19:00 课程需要改期或换教练代课。', createdAt: daysAgo(1), status: '待处理', resolution: '' },
    { id: 'tk_change_coach', type: '更换教练', memberId: IDS.mSun, coachId: IDS.coachZhou, title: '孙悦申请更换教练', detail: '会员反馈课程强度偏大、沟通节奏不适应，希望更换为女教练。', createdAt: daysAgo(2), status: '待处理', resolution: '' },
    { id: 'tk_expire', type: '课包到期', memberId: IDS.mZhao, coachId: IDS.coachZhou, title: '赵磊课包 14 天后到期', detail: '课包剩余 3 节，会员近期工作繁忙、到期前最多再上 2 节，需尽快沟通续费或发起延期申请。', createdAt: daysAgo(2), status: '处理中', resolution: '' },
    { id: 'tk_reschedule_done', type: '临时改期', memberId: IDS.mWang, coachId: IDS.coachLin, sessionId: 'ss_wang_4', title: '临时改期（已处理示例）', detail: '会员临时加班，申请将课程从 18:00 改到 19:00。', createdAt: daysAgo(25), status: '已解决', resolution: '顾问协调教练档期，课程顺延至当天 19:00，未计请假。' },
  ]

  // ---------- 续费跟进 ----------
  const renewals: RenewalFollowUp[] = [
    { id: 'rn_zhao', memberId: IDS.mZhao, consultantId: IDS.consultant, createdAt: daysAgo(2), summary: '电话沟通：结合周远教练记录，赵磊体脂降 2.1%、目标达成 70%，会员认可效果但觉得年底忙。建议到期前锁定 24 节力量周期套餐，本周五前给答复。', result: '跟进中' },
  ]

  // ---------- 延期申请（历史已办结） ----------
  const extensions: ExtensionRequest[] = [
    {
      id: 'ex_wang_1', packageId: 'pk_wang', memberId: IDS.mWang,
      consultantId: IDS.consultant, consultantName: '陈曦', createdAt: daysAgo(21),
      reason: '会员膝痛反复进入恢复期，连续两周无法上课，申请延期。',
      extendDays: 14, newSlots: [],
      status: '已通过', decidedAt: daysAgo(20), decidedBy: '王店长',
      decideNote: '同意延期 14 天，注意跟进恢复进度。',
    },
    {
      id: 'ex_he_1', packageId: 'pk_he', memberId: IDS.mHe,
      consultantId: IDS.consultant, consultantName: '陈曦', createdAt: daysAgo(10),
      reason: '会员出差两周，申请延期。',
      extendDays: 14, newSlots: [],
      status: '已通过', decidedAt: daysAgo(10), decidedBy: '王店长', decideNote: '同意。',
    },
    {
      id: 'ex_he_2', packageId: 'pk_he', memberId: IDS.mHe,
      consultantId: IDS.consultant, consultantName: '陈曦', createdAt: daysAgo(4),
      reason: '会员项目冲刺加班，申请再延期 16 天。',
      extendDays: 16, newSlots: [],
      status: '已通过', decidedAt: daysAgo(3), decidedBy: '王店长',
      decideNote: '第 2 次延期，已达合同上限，后续不再延期。',
    },
  ]

  // ---------- 课包承诺记录（所有承诺落字，防止口头延期争议） ----------
  const commitments: PackageCommitment[] = [
    {
      id: 'cm_wang_1', packageId: 'pk_wang', memberId: IDS.mWang, createdAt: daysAgo(20),
      actorRole: 'manager', actorName: '王店长', kind: '延期',
      content: `因膝痛恢复期，课包有效期延长 14 天至 ${addDays(daysAgo(45), 120)}；剩余课程按每周二、周五重排。（第 1/2 次延期）`,
    },
    {
      id: 'cm_he_1', packageId: 'pk_he', memberId: IDS.mHe, createdAt: daysAgo(10),
      actorRole: 'manager', actorName: '王店长', kind: '延期',
      content: '会员出差，课包有效期延长 14 天。（第 1/2 次延期）',
    },
    {
      id: 'cm_he_2', packageId: 'pk_he', memberId: IDS.mHe, createdAt: daysAgo(3),
      actorRole: 'manager', actorName: '王店长', kind: '延期',
      content: '会员加班冲刺，课包有效期再延长 16 天，累计 30 天。（第 2/2 次延期，已达合同上限，不得再延期）',
    },
  ]

  // ---------- 投诉 ----------
  const complaints: Complaint[] = [
    { id: 'cp_he', memberId: IDS.mHe, content: '最近两周想约的晚间时段总是约满，希望增加排课选择。', createdAt: daysAgo(3), status: '待处理', reply: '' },
  ]

  // ---------- 统一训练时间线 ----------
  const timeline: TimelineEvent[] = [
    { id: 'tl_01', memberId: IDS.mWang, at: daysAgo(50), kind: '预约体验', actorRole: 'member', actorName: '王晓彤', title: '预约体验课', detail: '运动基础：规律运动；右膝疼痛 5 分；目标：康复舒缓、减脂塑形；预算 500-700 元/节。' },
    { id: 'tl_02', memberId: IDS.mWang, at: daysAgo(47), kind: '安排体验', actorRole: 'consultant', actorName: '陈曦', title: '安排体验课', detail: '匹配林岚教练（理疗瑜伽/膝关节养护），时间 ' + daysAgo(46) + ' 19:00。' },
    { id: 'tl_03', memberId: IDS.mWang, at: daysAgo(46), kind: '体验测评', actorRole: 'coach', actorName: '林岚', title: '完成体验课测评', detail: '髂胫束紧张、右膝 Q 角偏大；建议理疗瑜伽+膝关节养护 24 节；风险提示已签署。', professional: true },
    { id: 'tl_04', memberId: IDS.mWang, at: daysAgo(45), kind: '购课', actorRole: 'member', actorName: '王晓彤', title: '确认购买课包', detail: '私教 24 节 · 膝关节养护，有效期 120 天；请假规则：每月最多 2 次、提前 12 小时。' },
    { id: 'tl_05', memberId: IDS.mWang, at: daysAgo(45), kind: '排课', actorRole: 'consultant', actorName: '陈曦', title: '生成排课计划', detail: '每周二、周五 19:00-20:00，林岚教练。' },
    { id: 'tl_06', memberId: IDS.mWang, at: daysAgo(29), kind: '请假', actorRole: 'member', actorName: '王晓彤', title: '请假 1 次', detail: '临时出差，符合请假规则（当月第 1 次，提前 24 小时）。' },
    { id: 'tl_07', memberId: IDS.mWang, at: daysAgo(25), kind: '改期', actorRole: 'consultant', actorName: '陈曦', title: '临时改期', detail: '会员临时加班，课程顺延至当天 19:00，未计请假。' },
    { id: 'tl_08', memberId: IDS.mWang, at: daysAgo(10), kind: '上课记录', actorRole: 'coach', actorName: '林岚', title: '第 6 节私教课完成', detail: '体感 8/10，右膝 3→5 分反复；教练备注：强度加急了，下节课必须降强度。', professional: true },
    { id: 'tl_09', memberId: IDS.mWang, at: daysAgo(9), kind: '不适上报', actorRole: 'member', actorName: '王晓彤', title: '上报右膝不适', detail: '课后第二天右膝外侧疼痛回到 5 分，上下楼明显。' },
    { id: 'tl_10', memberId: IDS.mWang, at: daysAgo(8), kind: '课程调整', actorRole: 'coach', actorName: '林岚', title: '调整训练计划', detail: '暂停静蹲等屈膝负重，改为膝关节减负版理疗序列；家庭练习改为直腿抬高。', professional: true },
    { id: 'tl_10b', memberId: IDS.mWang, at: daysAgo(20), kind: '延期审批', actorRole: 'manager', actorName: '王店长', title: '延期申请已通过', detail: `膝痛恢复期，课包有效期延长 14 天至 ${addDays(daysAgo(45), 120)}（第 1/2 次延期），剩余课程已自动重排。承诺已写入课包记录。` },
    { id: 'tl_11', memberId: IDS.mZhang, at: daysAgo(9), kind: '预约体验', actorRole: 'member', actorName: '张倩', title: '预约体验课', detail: '零基础；腰椎 3 分；目标：柔韧提升、康复舒缓；介意异性教练。' },
    { id: 'tl_12', memberId: IDS.mZhang, at: daysAgo(7), kind: '安排体验', actorRole: 'consultant', actorName: '陈曦', title: '安排体验课', detail: '按“介意异性教练”匹配苏晴教练（阴瑜伽/脊柱保养）。' },
    { id: 'tl_13', memberId: IDS.mZhang, at: daysAgo(6), kind: '体验测评', actorRole: 'coach', actorName: '苏晴', title: '完成体验课测评', detail: '骨盆轻度前倾，建议阴瑜伽+脊柱保养 16 节；风险提示已签署。', professional: true },
    { id: 'tl_14', memberId: IDS.mZhao, at: daysAgo(2), kind: '续费', actorRole: 'consultant', actorName: '陈曦', title: '续费跟进', detail: '基于训练记录沟通：体脂降 2.1%、目标达成 70%，建议续 24 节力量周期。' },
    { id: 'tl_15', memberId: IDS.mSun, at: daysAgo(2), kind: '更换教练', actorRole: 'member', actorName: '孙悦', title: '申请更换教练', detail: '课程强度偏大、沟通节奏不适应，希望更换为女教练。' },
    { id: 'tl_16', memberId: IDS.mHe, at: daysAgo(3), kind: '投诉', actorRole: 'member', actorName: '何静', title: '提交投诉', detail: '晚间时段总是约满，希望增加排课选择。' },
    { id: 'tl_17', memberId: IDS.mHe, at: daysAgo(1), kind: '请假', actorRole: 'coach', actorName: '周远', title: '教练请假', detail: '周远教练周四请假，何静 ' + addDays(t, 4) + ' 19:00 课程待协调。' },
    { id: 'tl_17b', memberId: IDS.mHe, at: daysAgo(10), kind: '延期审批', actorRole: 'manager', actorName: '王店长', title: '延期申请已通过', detail: '会员出差，课包有效期延长 14 天（第 1/2 次延期）。承诺已写入课包记录。' },
    { id: 'tl_17c', memberId: IDS.mHe, at: daysAgo(3), kind: '延期审批', actorRole: 'manager', actorName: '王店长', title: '延期申请已通过', detail: '会员加班冲刺，课包有效期再延长 16 天，累计 30 天（第 2/2 次延期，已达合同上限）。承诺已写入课包记录。' },
    { id: 'tl_18', memberId: IDS.mLi, at: daysAgo(1), kind: '预约体验', actorRole: 'member', actorName: '李敏', title: '预约体验课', detail: '偶尔运动；肩颈 4 分；目标：体态矫正、减压助眠；介意异性教练。' },
  ]

  return { accounts, coaches, bookings, assessments, packages, plans, sessions, records, leaves, tickets, renewals, extensions, commitments, complaints, timeline }
}

export const SEED_VERSION = 4
