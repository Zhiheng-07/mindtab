export function Popup() {
  return (
    <div
      style={{
        width: 280,
        padding: '16px 20px',
        background: 'var(--mt-bg)',
        color: 'var(--mt-text-primary)',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--mt-text-strong)' }}>
        MindTab
      </div>
      <p
        style={{
          marginTop: 8,
          fontSize: 12,
          color: 'var(--mt-text-muted)',
          lineHeight: 1.5,
        }}
      >
        点击扩展图标即可收藏当前页面到 MindTab。
      </p>
    </div>
  )
}
