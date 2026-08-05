// 公共 favicon 服务（DuckDuckGo / Google s2）。
//
// 设计说明（开源改造 C3，替代原自建中转 relay 的 /api/favicon-discover）：
// - 同步拼接 URL，不发网络请求、不做预验证。图标最终由扩展页 <img> 加载，
//   MV3 扩展页 CSP 不限制 https 的 img-src，无需额外 host 权限。
// - 服务 URL 只作为 Favicon 组件 onError 候选回退链的兜底（见 shared/ui/Favicon.tsx），
//   不写入书签数据——DDG 对未收录域名返回 404，未验证的 URL 入库会把
//   候选链短路成「仅服务兜底」（历史 bug，已在后台发现逻辑中移除）。
// - DuckDuckGo 在国内可达性好，作为首选；Google s2 作为兜底候选。

/** 公共 favicon 服务候选（按优先级排序），供 Favicon 组件回退链使用 */
export function faviconServiceCandidates(domain: string): string[] {
  return [
    `https://icons.duckduckgo.com/ip3/${domain}.ico`, // 国内可达性好，优先
    `https://www.google.com/s2/favicons?domain=${domain}&sz=64`, // 兜底
  ]
}
