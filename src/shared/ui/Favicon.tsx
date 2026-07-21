// Badge-first Favicon 组件（双 img 分层 — 零闪动）
// 展示层 img 稳定不变，探测层 img 隐藏加载。
// 新图加载成功后才更新展示层，用户永远不会看到闪动或碎图。

import { useCallback, useEffect, useMemo, useState } from 'react'
import { faviconCandidates, isGenericFavicon } from '@/shared/lib/favicon'
import { faviconServiceCandidates } from '@/shared/lib/faviconDiscovery'
import { FAVICON_MAP } from '@/shared/lib/faviconMap'

interface Props {
  src?: string
  domain: string
  title: string
  size: number
  /** true = 圆形（PinnedRow），false = 圆角方（BookmarkCard 等） */
  rounded?: boolean
}

export function Favicon({ src, domain, title, size, rounded = false }: Props) {
  // loadedSrc: 已成功加载的 URL（展示层使用，稳定不闪）
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [tryIndex, setTryIndex] = useState(0)

  // 构建候选列表（优先级：真实URL > 静态映射 > 通用路径探测 > 公共服务兜底）
  const candidates = useMemo(() => {
    const list: string[] = []
    if (src && !isGenericFavicon(src, domain)) {
      // Chrome tab.favIconUrl 等可靠来源 → 首选
      list.push(src)
    } else {
      if (src) list.push(src)
      // 静态映射（覆盖被墙/CF 防护的热门站点）
      const mapped = FAVICON_MAP[domain]
      if (mapped && !list.includes(mapped)) list.push(mapped)
      // 通用路径探测
      for (const c of faviconCandidates(domain)) {
        if (!list.includes(c)) list.push(c)
      }
    }
    // 公共服务兜底（DuckDuckGo → Google s2），失败则回落字母徽章
    for (const c of faviconServiceCandidates(domain)) {
      if (!list.includes(c)) list.push(c)
    }
    return list
  }, [src, domain])

  const currentSrc = tryIndex < candidates.length ? candidates[tryIndex] : null

  // src/domain 变化时（如 server 发现新 URL）→ 重新探测，但不清 loadedSrc
  useEffect(() => {
    setTryIndex(0)
  }, [src, domain])

  const handleProbeLoad = useCallback(() => {
    setLoadedSrc(currentSrc)
  }, [currentSrc])

  const handleProbeError = useCallback(() => {
    setTryIndex((i) => i + 1)
  }, [])

  const hasImage = loadedSrc !== null
  const char = (title || domain).slice(0, 1).toUpperCase()
  const radius = rounded ? '50%' : size <= 16 ? 4 : 8
  const fontSize = size <= 16 ? 12 : 13

  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: hasImage ? 'transparent' : 'var(--mt-badge-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        boxShadow: hasImage ? 'inset 0 0 0 0.5px var(--mt-favicon-border)' : 'none',
        transition: 'background 200ms ease, box-shadow 200ms ease',
      }}
    >
      {/* 字母徽章 — 始终渲染，图片加载成功后淡出 */}
      <span
        style={{
          color: 'var(--mt-badge-fg)',
          fontSize,
          fontWeight: rounded ? 600 : 500,
          opacity: hasImage ? 0 : 1,
          transition: 'opacity 200ms ease',
          lineHeight: 1,
        }}
      >
        {char}
      </span>

      {/* 展示层 — 稳定展示已加载成功的图片，不会被卸载/重建 */}
      {loadedSrc && (
        <img
          src={loadedSrc}
          alt=""
          style={{ ...imgStyle, opacity: 1, transition: 'opacity 200ms ease' }}
        />
      )}

      {/* 探测层 — opacity:0 隐藏，静默尝试候选 URL */}
      {currentSrc && currentSrc !== loadedSrc && (
        <img
          src={currentSrc}
          alt=""
          onLoad={handleProbeLoad}
          onError={handleProbeError}
          style={{ ...imgStyle, opacity: 0, pointerEvents: 'none' }}
        />
      )}
    </span>
  )
}
