// 相对时间格式化（中文）
// 用于卡片右上角的 "上次打开时间" 与待确认面板倒计时。

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

export function formatRelativeTime(ts: number, now = Date.now()): string {
  const diff = now - ts
  if (diff < 0) return '刚刚'
  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`
  if (diff < 2 * DAY) return '昨天'
  if (diff < WEEK) return `${Math.floor(diff / DAY)} 天前`
  if (diff < 4 * WEEK) return `${Math.floor(diff / WEEK)} 周前`
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

// 倒计时：还剩 N 小时 / N 分钟
export function formatRemaining(ts: number, ttlMs: number, now = Date.now()): string {
  const remain = ts + ttlMs - now
  if (remain <= 0) return '已过期'
  if (remain < HOUR) return `还剩 ${Math.max(1, Math.floor(remain / MINUTE))} 分钟`
  if (remain < DAY) return `还剩 ${Math.floor(remain / HOUR)} 小时`
  return `还剩 ${Math.floor(remain / DAY)} 天`
}
