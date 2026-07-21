// 流光骨架：1.5s 循环，#F5F5F5 → #EEEEEE → #F5F5F5
// 用法：<Skeleton width="60%" height={14} />

interface Props {
  width?: number | string
  height?: number | string
  radius?: number | string
}

const ANIM_NAME = 'mt-skeleton-shimmer'

if (typeof document !== 'undefined' && !document.getElementById(ANIM_NAME)) {
  const style = document.createElement('style')
  style.id = ANIM_NAME
  style.textContent = `
@keyframes ${ANIM_NAME} {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}`
  document.head.appendChild(style)
}

export function Skeleton({ width = '100%', height = 12, radius = 6 }: Props) {
  return (
    <div
      aria-hidden
      style={{
        width,
        height,
        borderRadius: radius,
        background:
          'linear-gradient(90deg, var(--mt-bg-secondary) 0%, var(--mt-border) 50%, var(--mt-bg-secondary) 100%)',
        backgroundSize: '200% 100%',
        animation: `${ANIM_NAME} 1.5s linear infinite`,
      }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div
      className="glass glass-border"
      style={{
        borderRadius: 'var(--mt-radius-2xl)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 130,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Skeleton width={20} height={20} radius={6} />
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" height={14} />
        </div>
      </div>
      <Skeleton width="40%" height={11} />
      <div style={{ display: 'flex', gap: 6 }}>
        <Skeleton width={40} height={18} radius={9999} />
        <Skeleton width={56} height={18} radius={9999} />
      </div>
    </div>
  )
}
