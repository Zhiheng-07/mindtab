import { useEffect, useRef } from 'react'
import lottie, { type AnimationItem } from 'lottie-web'
import animationData from '@/shared/assets/data/sidebar-menu.json'

interface Props {
  /** true = X state (sidebar open), false = hamburger state (sidebar closed) */
  open: boolean
  size?: number
}

export function LottieMenuIcon({ open, size = 16 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<AnimationItem | null>(null)
  const prevOpen = useRef(open)

  useEffect(() => {
    if (!containerRef.current) return

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      animationData,
    })

    // 始终从 hamburger 状态开始
    anim.goToAndStop(0, true)
    // 如果 open=true（侧导栏正在打开），播放 hamburger→X
    if (open) {
      anim.setDirection(1)
      anim.play()
    }

    animRef.current = anim
    return () => anim.destroy()
  }, [])

  useEffect(() => {
    const anim = animRef.current
    if (!anim) return

    if (open !== prevOpen.current) {
      prevOpen.current = open
      if (open) {
        // hamburger → X
        anim.setDirection(1)
        anim.goToAndPlay(0, true)
      } else {
        // X → hamburger
        anim.setDirection(-1)
        anim.goToAndPlay(anim.totalFrames - 1, true)
      }
    }
  }, [open])

  return (
    <div
      ref={containerRef}
      className="dark:invert"
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  )
}
