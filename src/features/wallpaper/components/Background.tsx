import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { getVideoUrl } from '../lib/videoCache'
import { getTheme, DEFAULT_THEME_ID, type VideoTheme } from '../lib/videoThemes'

export function Background() {
  const [isDark, setIsDark] = useState(false)
  // 后续设置面板切换主题时调用 setTheme
  const [theme, _setTheme] = useState<VideoTheme>(() => getTheme(DEFAULT_THEME_ID))

  useEffect(() => {
    const check = () => {
      const html = document.documentElement
      const explicit = html.getAttribute('data-theme')
      if (explicit === 'dark' || html.classList.contains('dark')) {
        setIsDark(true)
      } else if (explicit === 'light' || html.classList.contains('light')) {
        setIsDark(false)
      } else {
        setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
      }
    }
    check()

    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    })

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener('change', check)

    return () => {
      observer.disconnect()
      mql.removeEventListener('change', check)
    }
  }, [])

  // 后续从 chrome.storage 读取用户选择的主题 ID
  // useEffect(() => { chrome.storage.local.get('themeId', ...) }, [])

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ zIndex: -1, background: isDark ? '#000000' : '#ffffff' }}
    >
      {/* ── 浅色：视频背景 ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: isDark ? 0 : 1,
          transition: 'none',
          pointerEvents: 'none',
        }}
      >
        <VideoLayer
          remoteUrl={theme.lightUrl}
          active={!isDark}
          objectFit={theme.lightFit ?? 'cover'}
          transform={undefined}
        />
      </div>

      {/* ── 深色：视频背景 ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: isDark ? 1 : 0,
          transition: 'none',
          pointerEvents: 'none',
        }}
      >
        <VideoLayer
          remoteUrl={theme.darkUrl}
          active={isDark}
          objectFit={theme.darkFit ?? 'contain'}
          transform={theme.darkTransform}
        />
      </div>
    </div>
  )
}

/* ── 通用视频层：支持 MP4 + HLS，自动缓存 ── */

const isHls = (url: string) => url.endsWith('.m3u8') || url.includes('.m3u8')

interface VideoLayerProps {
  remoteUrl: string
  active: boolean
  objectFit: 'cover' | 'contain'
  transform?: string
}

function VideoLayer({ remoteUrl, active, objectFit, transform }: VideoLayerProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  // 加载视频源（优先缓存 → 远程 → 后台静默缓存）
  useEffect(() => {
    const video = ref.current
    if (!video) return
    let revoke: string | null = null

    void (async () => {
      const { url, fromCache } = await getVideoUrl(remoteUrl)
      if (fromCache) revoke = url // blob URL 需要清理

      if (isHls(url)) {
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: false })
          hls.loadSource(url)
          hls.attachMedia(video)
          hlsRef.current = hls
        } else {
          video.src = url
        }
      } else {
        video.src = url
      }

      // 如果当前应该播放，立即开始
      if (active) video.play().catch(() => {})
    })()

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [remoteUrl])

  // 播放/暂停控制
  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (active) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [active])

  return (
    <video
      ref={ref}
      muted
      playsInline
      loop
      style={{
        width: '100%',
        height: '100%',
        objectFit,
        objectPosition: 'center center',
        transform,
      }}
    />
  )
}
