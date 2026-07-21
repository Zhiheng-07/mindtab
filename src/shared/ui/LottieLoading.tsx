import { useEffect, useRef } from 'react'
import lottie, { type AnimationItem } from 'lottie-web'
import animationData from '@/shared/assets/lottie/loading.json'

interface Props {
  size?: number
  className?: string
  style?: React.CSSProperties
}

export function LottieLoading({ size = 32, className, style }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<AnimationItem | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData,
    })

    animRef.current = anim
    return () => anim.destroy()
  }, [])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    />
  )
}
