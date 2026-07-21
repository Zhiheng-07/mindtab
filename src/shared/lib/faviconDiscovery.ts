// 公共 favicon 服务（DuckDuckGo / Google s2）。
//
// 设计说明（开源改造 C3，替代原自建中转 relay 的 /api/favicon-discover）：
// - 同步拼接 URL，不发网络请求、不做预验证。图标最终由扩展页 <img> 加载，
//   MV3 扩展页 CSP 不限制 https 的 img-src，无需额外 host 权限。
// - DuckDuckGo 对未知域也会返回占位图标，预验证价值低；真正的可用性
//   由 Favicon 组件的 onError 候选回退链兜底（见 shared/ui/Favicon.tsx）。
// - DuckDuckGo 在国内可达性好，作为首选；Google s2 作为兜底候选。

/** 公共 favicon 服务候选（按优先级排序），供 Favicon 组件回退链使用 */
export function faviconServiceCandidates(domain: string): string[] {
  return [
    `https://icons.duckduckgo.com/ip3/${domain}.ico`, // 国内可达性好，优先
    `https://www.google.com/s2/favicons?domain=${domain}&sz=64`, // 兜底
  ]
}

/**
 * 发现指定页面的 favicon URL（返回公共服务首选项）。
 * 签名保持 async 以兼容调用方（background/serviceWorker.ts）。
 * @returns favicon URL，或 null
 */
export async function discoverFavicon(
  url: string,
  domain: string,
): Promise<string | null> {
  void url // 参数保留以维持调用方签名不变（公共服务方案下未使用）
  return faviconServiceCandidates(domain)[0]
}
