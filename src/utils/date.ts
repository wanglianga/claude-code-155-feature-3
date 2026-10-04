// 日期工具：全部基于运行时的“今天”，保证演示数据永远是当前周
import type { WeekSlot } from '../types'

export function fmt(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function today(): string {
  return fmt(new Date())
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return fmt(d)
}

export function daysAgo(n: number): string {
  return addDays(today(), -n)
}

export function daysBetween(a: string, b: string): number {
  const ms = new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()
  return Math.round(ms / 86400000)
}

export function weekdayOf(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay()
}

export const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function weekdayCn(dateStr: string): string {
  return WEEKDAY_CN[weekdayOf(dateStr)]
}

/** 从 from（含）起找到 weekday(0-6) 的下一个日期 */
export function nextWeekday(from: string, weekday: number): string {
  let d = from
  for (let i = 0; i < 8; i++) {
    if (weekdayOf(d) === weekday) return d
    d = addDays(d, 1)
  }
  return d
}

export function nowStr(): string {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${fmt(d)} ${hh}:${mm}`
}

let seq = 0
export function uid(prefix: string): string {
  seq += 1
  return `${prefix}_${Date.now().toString(36)}_${seq}_${Math.floor(Math.random() * 1e4)}`
}

// ---------------- 排期：按每周固定时段生成课程日期 ----------------

/** 按 slots（每周固定时段）生成从 from（含）起的前 count 个上课日期，按时间升序 */
export function upcomingDates(from: string, slots: WeekSlot[], count: number): { date: string; time: string; weekday: number }[] {
  if (!slots.length || count <= 0) return []
  const sorted = [...slots].sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time))
  const sunday = addDays(from, -weekdayOf(from))
  const out: { date: string; time: string; weekday: number }[] = []
  for (let w = 0; w < 40 && out.length < count; w++) {
    for (const s of sorted) {
      const d = addDays(sunday, w * 7 + s.weekday)
      if (d >= from) out.push({ date: d, time: s.time, weekday: s.weekday })
      if (out.length >= count) break
    }
  }
  return out
}

/** 按频率计算：从 from（含）起、到期日（含）之前最多还能上几节 */
export function sessionsBeforeExpiry(expiryDate: string, slots: WeekSlot[], from = today()): number {
  if (!slots.length) return 0
  const sunday = addDays(from, -weekdayOf(from))
  let n = 0
  for (let w = 0; w < 60; w++) {
    for (const s of slots) {
      const d = addDays(sunday, w * 7 + s.weekday)
      if (d >= from && d <= expiryDate) n += 1
    }
  }
  return n
}

/** 频率的中文描述，如「每周一、周三 19:00-20:00」 */
export function slotsText(slots: WeekSlot[]): string {
  if (!slots.length) return '未排课'
  return slots.map(s => `每周${'日一二三四五六'[s.weekday]} ${s.time}`).join('、')
}

export interface RelayoutResult { date: string; time: string; changed: boolean; outOfRange: boolean }

/**
 * 课包日历自动重排（延期通过 / 调整频率后调用）：
 * - keepDates=true（仅延期）：保留仍在新有效期内的原课程，把超出有效期的课补到最早的空档；
 * - keepDates=false（调整频率）：剩余课程整体按新频率从今天起重新落位；
 * - 新有效期内排不下的课保留原日期并标记 outOfRange（页面提示，不静默丢课）。
 */
export function relayoutSessions(
  pending: { date: string; time: string }[],
  slots: WeekSlot[],
  expiryDate: string,
  keepDates: boolean,
): RelayoutResult[] {
  const occ = new Set<string>()
  const res: ({ date: string; time: string } | null)[] = pending.map(() => null)

  if (keepDates) {
    pending.forEach((s, i) => {
      if (s.date >= today() && s.date <= expiryDate) {
        res[i] = { date: s.date, time: s.time }
        occ.add(s.date + ' ' + s.time)
      }
    })
  }

  // 补位时段池：不早于最早一节待上课（不把课程拉到比原计划更早的日期），不晚于新有效期
  const validPending = pending.filter(s => s.date >= today()).map(s => s.date).sort()
  const floor = validPending[0] ?? today()
  const sorted = [...slots].sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time))
  const instances: { date: string; time: string }[] = []
  if (sorted.length) {
    const sunday = addDays(floor, -weekdayOf(floor))
    for (let w = 0; w < 60; w++) {
      for (const s of sorted) {
        const d = addDays(sunday, w * 7 + s.weekday)
        if (d >= floor && d <= expiryDate) instances.push({ date: d, time: s.time })
      }
    }
  }
  let ptr = 0
  return res.map((r, i) => {
    let next = r
    if (!next) {
      while (ptr < instances.length && occ.has(instances[ptr].date + ' ' + instances[ptr].time)) ptr += 1
      if (ptr < instances.length) {
        next = { ...instances[ptr] }
        occ.add(next.date + ' ' + next.time)
        ptr += 1
      } else {
        next = { ...pending[i] } // 有效期内排不下，保留原日期交由页面提示
      }
    }
    return {
      date: next.date, time: next.time,
      changed: next.date !== pending[i].date || next.time !== pending[i].time,
      outOfRange: next.date > expiryDate,
    }
  })
}
