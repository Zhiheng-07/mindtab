// 隐私授权状态存取，从 PrivacyModal.tsx 拆出（组件文件只导出组件，保证 fast refresh）。

import { get as storageGet, set as storageSet, STORAGE_KEYS } from '@/shared/storage'

export type PrivacyState = 'unknown' | 'agreed' | 'dismissed'

export async function getPrivacyState(): Promise<PrivacyState> {
  const v = await storageGet<PrivacyState>(STORAGE_KEYS.privacyAgreed as string, 'unknown')
  return v ?? 'unknown'
}

export async function setPrivacyState(s: PrivacyState): Promise<void> {
  await storageSet(STORAGE_KEYS.privacyAgreed as string, s)
}
