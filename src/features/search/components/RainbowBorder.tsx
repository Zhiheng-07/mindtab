import { useEffect, useRef, useState } from 'react'

const DURATION = 1000
const SW = 1 // stroke-width
const INITIAL_INTERVAL = 4_000  // 前 3 次间隔 4s
const LOOP_INTERVAL = 8_000    // 之后每 8s
const INITIAL_PLAYS = 3

// 8 段平滑过渡：头→尾（蓝→紫→红→橙→黄→黄绿→绿→浅绿）
const SEGMENTS = [
  { color: '#6abf69', opacity: 0.10, shift: 7 },  // 浅绿（尾）
  { color: '#34a853', opacity: 0.23, shift: 6 },  // 绿
  { color: '#8cc152', opacity: 0.36, shift: 5 },  // 黄绿
  { color: '#fbbc05', opacity: 0.49, shift: 4 },  // 黄
  { color: '#f09819', opacity: 0.62, shift: 3 },  // 橙
  { color: '#ea4335', opacity: 0.74, shift: 2 },  // 红
  { color: '#7b68c8', opacity: 0.87, shift: 1 },  // 紫
  { color: '#4285f4', opacity: 1.00, shift: 0 },  // 蓝（头）
]

// ───── 模块级调度器 ─────
// 定时器在模块作用域，不随组件 unmount 被清除。
// 组件只负责注册/注销播放回调。

let playCount = 0
let lastPlayAt = 0
let scheduledTimerId = 0
let animating = false
let playerFn: (() => void) | null = null
let isHoveredFn: (() => boolean) | null = null

/** 幂等调度：计算下次延迟，设模块级 timer */
function schedule(): void {
  clearTimeout(scheduledTimerId)
  scheduledTimerId = 0

  if (animating) return // 动画完成后 notifyDone() 会再调 schedule()

  const now = Date.now()
  let delay: number
  if (playCount === 0) {
    delay = 0
  } else if (playCount < INITIAL_PLAYS) {
    delay = Math.max(0, INITIAL_INTERVAL - (now - lastPlayAt))
  } else {
    delay = Math.max(0, LOOP_INTERVAL - (now - lastPlayAt))
  }

  scheduledTimerId = window.setTimeout(tick, delay)
}

/** timer 回调：检查状态 → 播放或重试 */
function tick(): void {
  scheduledTimerId = 0

  // 组件未挂载 — 等下次 mount 时调 schedule()
  if (!playerFn) return

  // hover 或正在播放 — 1s 后重试
  if (animating || (isHoveredFn && isHoveredFn())) {
    scheduledTimerId = window.setTimeout(tick, 1000)
    return
  }

  animating = true
  playerFn()
}

/** 动画完成时调用 — 推进计数，调度下一次 */
function notifyDone(): void {
  animating = false
  playCount++
  lastPlayAt = Date.now()
  schedule()
}

// ───── 组件 ─────

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>
  hovered: boolean
}

export function RainbowBorder({ containerRef, hovered }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const rectsRef = useRef<SVGRectElement[]>([])
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const dimsRef = useRef({ w: 0, h: 0 })
  const hoveredRef = useRef(hovered)
  const rafRef = useRef(0)

  // 同步 hovered 到 ref
  useEffect(() => { hoveredRef.current = hovered }, [hovered])

  // 测量 pill 尺寸
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const next = { w: el.offsetWidth, h: el.offsetHeight }
      dimsRef.current = next
      setDims(next)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])

  // 注册播放回调 + 启动调度
  useEffect(() => {
    // 注册为当前播放器
    isHoveredFn = () => hoveredRef.current

    playerFn = () => {
      const svg = svgRef.current
      const rects = rectsRef.current
      const { w, h } = dimsRef.current
      if (!svg || rects.length === 0 || w === 0 || h === 0) {
        // DOM 未就绪 — 500ms 后重试
        animating = false
        scheduledTimerId = window.setTimeout(tick, 500)
        return
      }

      const rW = w + SW
      const rH = h + SW
      const P = 2 * (rW - rH) + Math.PI * rH
      const segLen = P * 0.035

      // 初始化 dasharray
      for (const rect of rects) {
        rect.setAttribute('stroke-dasharray', `${segLen} ${P - segLen}`)
        rect.setAttribute('stroke-dashoffset', String(P))
      }
      svg.style.opacity = '1'

      const start = performance.now()
      const animTick = (now: number) => {
        const t = Math.min((now - start) / DURATION, 1)
        const ease = 0.03 + 0.97 * t * t
        const base = P * (1 - ease)

        for (let i = 0; i < rects.length; i++) {
          rects[i].setAttribute('stroke-dashoffset', String(base + SEGMENTS[i].shift * segLen))
        }

        svg.style.opacity = t > 0.7 ? String(1 - (t - 0.7) / 0.3) : '1'

        if (t < 1) {
          rafRef.current = requestAnimationFrame(animTick)
        } else {
          // 动画结束
          svg.style.opacity = '0'
          rafRef.current = 0
          notifyDone()
        }
      }
      rafRef.current = requestAnimationFrame(animTick)
    }

    // 启动调度（幂等，会清理旧 timer 并重算延迟）
    schedule()

    return () => {
      playerFn = null
      isHoveredFn = null
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0

      // mid-animation unmount：不算完成播放，重新调度
      if (animating) {
        animating = false
        schedule()
      }
      // 注意：不清 scheduledTimerId — timer 存活，
      // tick() 发现 playerFn===null 时静默返回
    }
  }, [])

  if (dims.w === 0 || dims.h === 0) return null

  const W = dims.w
  const H = dims.h
  const half = SW / 2
  const rW = W + SW
  const rH = H + SW
  const rRx = (H + SW) / 2

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: -SW,
        left: -SW,
        width: W + SW * 2,
        height: H + SW * 2,
        pointerEvents: 'none',
        overflow: 'visible',
        opacity: 0,
      }}
    >
      {SEGMENTS.map((seg, i) => (
        <rect
          key={i}
          ref={(el) => { if (el) rectsRef.current[i] = el }}
          x={half}
          y={half}
          width={rW}
          height={rH}
          rx={rRx}
          ry={rRx}
          fill="none"
          stroke={seg.color}
          strokeWidth={SW}
          opacity={seg.opacity}
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}
