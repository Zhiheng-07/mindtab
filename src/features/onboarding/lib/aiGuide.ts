// AI 绑定引导的展示判定 + 「已弹出」标记存取。
// decideAiGuide 为纯函数（便于单测）；弹出时机的编排见 hooks/useOnboardingFlow.ts。

import { get as storageGet, set as storageSet, STORAGE_KEYS } from '@/shared/storage'
import type { PrivacyState } from './privacy'

export interface AiGuideInput {
  privacy: PrivacyState
  /** 隐私授权弹窗是否正在显示 */
  privacyModalOpen: boolean
  /** 版本更新弹窗是否正在显示 */
  whatsNewOpen: boolean
  /** 是否已弹出过（mt:aiGuideShown） */
  guideShown: boolean
  aiConfigured: boolean
}

/**
 * 是否弹出 AI 绑定引导：已同意隐私、前序弹窗（隐私 / 版本更新）都已关闭、
 * 从未弹过、且尚未配置 AI。四条同时满足才弹，保证每人最多一次、不与其他弹窗叠加。
 */
export function decideAiGuide({
  privacy,
  privacyModalOpen,
  whatsNewOpen,
  guideShown,
  aiConfigured,
}: AiGuideInput): boolean {
  return privacy === 'agreed' && !privacyModalOpen && !whatsNewOpen && !guideShown && !aiConfigured
}

export async function getAiGuideShown(): Promise<boolean> {
  return (await storageGet<boolean>(STORAGE_KEYS.aiGuideShown, false)) ?? false
}

export async function markAiGuideShown(): Promise<void> {
  await storageSet(STORAGE_KEYS.aiGuideShown, true)
}
