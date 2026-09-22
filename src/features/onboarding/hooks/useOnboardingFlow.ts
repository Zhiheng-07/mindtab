// 首屏引导弹窗编排：隐私授权 → 版本更新 → AI 绑定引导。
// - 新用户：隐私弹窗「开始使用」后弹 AI 引导
// - 升级用户：版本更新弹窗「知道了」后弹 AI 引导（仅未配置 AI 者）
// - 拒绝隐私的用户：暂不弹，日后经顶部条同意隐私后再弹
// AI 引导在事件回调里判定（而非 effect），弹出即写 mt:aiGuideShown，每人只弹一次。

import { useEffect, useState } from 'react'
import { refreshAiStatus } from '@/shared/lib/aiStatus'
import { getPrivacyState, setPrivacyState, type PrivacyState } from '../lib/privacy'
import { shouldShowWhatsNew } from '../lib/whatsNew'
import { decideAiGuide, getAiGuideShown, markAiGuideShown } from '../lib/aiGuide'

export function useOnboardingFlow() {
  const [privacy, setPrivacy] = useState<PrivacyState>('agreed')
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [showWhatsNew, setShowWhatsNew] = useState(false)
  const [showAiGuide, setShowAiGuide] = useState(false)
  // AI 引导判定所需的持久状态；null = 首屏检查尚未完成（此前不做判定）
  const [guideCtx, setGuideCtx] = useState<{ guideShown: boolean; aiConfigured: boolean } | null>(
    null,
  )

  useEffect(() => {
    void Promise.all([
      getPrivacyState(),
      shouldShowWhatsNew(),
      getAiGuideShown(),
      refreshAiStatus(),
    ]).then(([p, whatsNew, guideShown, aiConfigured]) => {
      setPrivacy(p)
      if (p === 'unknown') setShowPrivacyModal(true)
      if (whatsNew) setShowWhatsNew(true)
      // 兜底：已同意隐私、无前序弹窗、但从未弹过（如在另一个标签页关掉了更新弹窗）→ 首屏直接判定
      const show = decideAiGuide({
        privacy: p,
        privacyModalOpen: p === 'unknown',
        whatsNewOpen: whatsNew,
        guideShown,
        aiConfigured,
      })
      setGuideCtx({ guideShown: guideShown || show, aiConfigured })
      if (show) {
        setShowAiGuide(true)
        void markAiGuideShown()
      }
    })
  }, [])

  const maybeShowAiGuide = (next: {
    privacy: PrivacyState
    privacyModalOpen: boolean
    whatsNewOpen: boolean
  }) => {
    if (!guideCtx || !decideAiGuide({ ...next, ...guideCtx })) return
    setShowAiGuide(true)
    setGuideCtx({ ...guideCtx, guideShown: true })
    void markAiGuideShown()
  }

  const agreePrivacy = async () => {
    await setPrivacyState('agreed')
    setPrivacy('agreed')
    setShowPrivacyModal(false)
    maybeShowAiGuide({ privacy: 'agreed', privacyModalOpen: false, whatsNewOpen: showWhatsNew })
  }

  const dismissPrivacy = async () => {
    await setPrivacyState('dismissed')
    setPrivacy('dismissed')
    setShowPrivacyModal(false)
  }

  const closeWhatsNew = () => {
    setShowWhatsNew(false)
    maybeShowAiGuide({ privacy, privacyModalOpen: showPrivacyModal, whatsNewOpen: false })
  }

  const closeAiGuide = () => {
    setShowAiGuide(false)
    // 引导内可能已保存配置：刷新缓存，横幅 / 卡片状态随之更新
    void refreshAiStatus()
  }

  return {
    privacy,
    showPrivacyModal,
    showWhatsNew,
    showAiGuide,
    openPrivacyModal: () => setShowPrivacyModal(true),
    agreePrivacy,
    dismissPrivacy,
    closeWhatsNew,
    closeAiGuide,
  }
}
