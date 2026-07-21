// 数据库公共层统一出口。
// 领域类型 + 连接基础设施 + 跨表操作。
// 各 feature 自己的表 CRUD 在 features/<x>/db.ts，不在这里。

export type { IndexStatus, Bookmark, PendingBookmark, Folder } from './types'
export { scopeKey } from './types'
export { openDB, tx } from './connection'
export { applyIndex, findByUrl, clearAllData } from './crossTable'
