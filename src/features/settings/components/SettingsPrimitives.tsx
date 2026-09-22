// 设置面板通用子组件（Section / Row / Segmented）。
// 从 SettingsModal.tsx 提取，供 SettingsModal 与 AiSettingsSection 共用，
// 仅限 settings feature 内部相对导入。

export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {title && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--mt-text-placeholder)',
            fontWeight: 500,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            paddingLeft: 4,
          }}
        >
          {title}
        </div>
      )}
      <div
        className="divide-y divide-[var(--mt-border)]"
        style={{
          border: '1px solid var(--mt-border)',
          borderRadius: 'var(--mt-radius-lg)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </section>
  )
}

export function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, color: 'var(--mt-text-strong)' }}>{label}</span>
        {hint && (
          <span style={{ fontSize: 11, color: 'var(--mt-text-muted)' }}>{hint}</span>
        )}
      </div>
      {children}
    </div>
  )
}

export function Segmented({
  value,
  options,
  onChange,
  wrap,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  wrap?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: wrap ? 'wrap' : undefined,
        background: 'var(--mt-bg-secondary)',
        border: '1px solid var(--mt-border)',
        borderRadius: 'var(--mt-radius-md)',
        padding: 2,
        gap: wrap ? 2 : undefined,
      }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={
              active
                ? 'bg-[var(--mt-glass-bg-solid)] text-[var(--mt-text-strong)] font-medium'
                : 'bg-transparent text-[var(--mt-text-muted)] hover:bg-[var(--mt-surface-hover)] hover:text-[var(--mt-text-secondary)]'
            }
            style={{
              padding: '4px 12px',
              fontSize: 12,
              border: 'none',
              borderRadius: 'var(--mt-radius-sm)',
              cursor: 'pointer',
              transition: 'background 120ms ease, color 120ms ease',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
