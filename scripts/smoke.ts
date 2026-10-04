/* 冒烟测试：延期申请 → 审批 → 自动重排 → 合同规则拦截（node 环境跑 Pinia store） */
import { setActivePinia, createPinia } from 'pinia'

// localStorage stub（store 的 init/persist 依赖）
const store: Record<string, string> = {}
;(globalThis as any).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
}

import { useDataStore } from '../src/stores/data'
import { IDS } from '../src/data/seed'
import { addDays, today } from '../src/utils/date'

setActivePinia(createPinia())
const d = useDataStore()
d.init()

let failed = 0
const assert = (cond: boolean, msg: string) => {
  if (!cond) { failed++; console.error('  ✗ FAIL:', msg) } else { console.log('  ✓', msg) }
}

console.log('— 种子场景 —')
const zhao = d.packages.find(p => p.id === 'pk_zhao')!
assert(zhao.totalSessions - zhao.usedSessions === 3, '赵磊课包剩余 3 节')
assert(zhao.expiryDate === addDays(today(), 14), '赵磊课包 14 天（两周）后到期')
assert(zhao.extensionCount === 0, '赵磊尚未延期')
const wang = d.packages.find(p => p.id === 'pk_wang')!
assert(wang.extensionCount === 1 && wang.extensionDaysTotal === 14, '王晓彤已延期 1 次/14 天')
const he = d.packages.find(p => p.id === 'pk_he')!
assert(he.extensionCount === 2 && he.extensionDaysTotal === 30, '何静已延期 2 次/30 天（达上限）')
assert(d.commitments.length === 3, '种子含 3 条历史承诺记录')

console.log('— 顾问发起延期申请（工作原因 + 调频） —')
const check = d.submitExtensionRequest('pk_zhao', IDS.consultant, '陈曦', {
  reason: '会员工作外派两周，无法按期完成',
  extendDays: 14,
  newSlots: [{ weekday: 1, time: '19:00-20:00' }, { weekday: 4, time: '19:00-20:00' }],
})
assert(check.canApply, '赵磊可申请延期')
const req = d.extensions.find(e => e.packageId === 'pk_zhao' && e.status === '待审批')!
assert(!!req, '延期申请已创建（待审批）')
assert(d.pendingExtensions.length === 1, '店长待审批列表有 1 条')

console.log('— 店长批准 → 自动重排 —')
d.decideExtension(req.id, true, '同意，注意跟进', '王店长')
const zhao2 = d.packages.find(p => p.id === 'pk_zhao')!
assert(zhao2.expiryDate === addDays(today(), 28), `到期日 14→28 天后（${zhao2.expiryDate}）`)
assert(zhao2.extensionCount === 1 && zhao2.extensionDaysTotal === 14, '延期计数更新为 1 次/14 天')
const upcoming = d.sessions.filter(s => s.packageId === 'pk_zhao' && s.status === '待上课').sort((a, b) => a.date.localeCompare(b.date))
assert(upcoming.length === 3, `剩余 3 节全部重排（实际 ${upcoming.length} 节）`)
assert(upcoming.every(s => s.date > today() && s.date <= zhao2.expiryDate), '重排课程全部在有效期内')
assert(upcoming.every(s => [1, 4].includes(new Date(s.date + 'T00:00:00').getDay())), '重排课程均落在周一/周四新频率')
const cm = d.commitments.find(c => c.packageId === 'pk_zhao')
assert(!!cm && cm.kind === '延期' && cm.content.includes('延长 14 天'), '延期承诺已写入课包记录')
assert(d.tickets.find(t => t.id === 'tk_expire')!.status === '已解决', '课包到期工单自动办结')
assert(d.timeline.some(e => e.memberId === IDS.mZhao && e.kind === '延期审批'), '时间线已记录延期审批')

console.log('— 合同规则拦截 —')
const heCheck = d.extensionCheck(he)
assert(!heCheck.canApply && heCheck.blockReason.includes('上限'), '何静达 2 次上限，不可再申请')
const heRes = d.submitExtensionRequest('pk_he', IDS.consultant, '陈曦', { reason: '再想延期', extendDays: 7, newSlots: [] })
assert(!heRes.canApply, '何静的延期申请被系统拦截（顾问不能无限口头承诺）')
const over = d.submitExtensionRequest('pk_zhao', IDS.consultant, '陈曦', { reason: 'test', extendDays: 31, newSlots: [] })
assert(!over.canApply, '单次延期超 30 天被拦截')
const overTotal = d.submitExtensionRequest('pk_zhao', IDS.consultant, '陈曦', { reason: 'test', extendDays: 32, newSlots: [] })
assert(!overTotal.canApply, '累计延期超 45 天被拦截')

console.log('— 仅调频（不延期） —')
const sun = d.packages.find(p => p.id === 'pk_sun')!
const before = sun.expiryDate
const fr = d.submitExtensionRequest('pk_sun', IDS.consultant, '陈曦', { reason: '会员希望改为每周两节加快进度', extendDays: 0, newSlots: [{ weekday: 3, time: '20:00-21:00' }, { weekday: 6, time: '10:00-11:00' }] })
assert(fr.canApply, '可发起仅调频申请')
const frq = d.extensions.find(e => e.packageId === 'pk_sun' && e.status === '待审批')!
d.decideExtension(frq.id, true, '', '王店长')
const sun2 = d.packages.find(p => p.id === 'pk_sun')!
assert(sun2.expiryDate === before && sun2.extensionCount === 0, '仅调频不改变到期日与延期计数')
assert(d.commitments.some(c => c.packageId === 'pk_sun' && c.kind === '调频'), '调频承诺已写入课包记录')

console.log(failed ? `\n${failed} 项失败` : '\n全部通过')
process.exit(failed ? 1 : 0)
