// 版本更新弹窗的展示判定，从 WhatsNewModal.tsx 拆出（组件文件只导出组件，保证 fast refresh）。

import { get as storageGet, set as storageSet, STORAGE_KEYS } from '@/shared/storage'

export const CURRENT_VERSION = '0.2.3'

export async function shouldShowWhatsNew(): Promise<boolean> {
  const seen = await storageGet<string>(STORAGE_KEYS.lastSeenVersion, '')
  if (!seen) {
    // 新用户首次安装：静默初始化为当前版本，不弹更新弹窗
    // （他们没经历过旧版本，看「迁移」类文案会困惑）
    await storageSet(STORAGE_KEYS.lastSeenVersion, CURRENT_VERSION)
    return false
  }
  return seen !== CURRENT_VERSION
}
