// chrome.storage.local 的 key 常量。
// 设置项、白名单状态、搜索历史、首次安装标记等都用这里的 key。

export const STORAGE_KEYS = {
  darkMode: 'mt:darkMode',
  privacyAgreed: 'mt:privacyAgreed',
  importGuideShown: 'mt:importGuideShown',
  searchHistory: 'mt:searchHistory',
  improveProduct: 'mt:improveProduct',
  lastSeenVersion: 'mt:lastSeenVersion',
  // AI 直连配置（provider/apiKey/baseUrl/model），单 key 存整个对象，保证原子读写
  aiConfig: 'mt:aiConfig',
} as const
