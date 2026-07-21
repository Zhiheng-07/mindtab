// 存储公共层统一出口。
// key 常量 + 通用 get/set/remove/onChange。
// 搜索历史 / 配额等业务存储在 features/search/storage.ts。

export { STORAGE_KEYS } from './keys'
export { get, set, remove, onChange } from './engine'
