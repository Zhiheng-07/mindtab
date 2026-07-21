// Favicon URL 工具
// 直连站点常见路径 — 在中国可用，无需翻墙

/** 站点根目录 favicon（保存书签时的默认值） */
export function faviconUrl(domain: string): string {
  return `https://${domain}/favicon.ico`
}

/**
 * 生成候选 favicon URL 列表（按命中率排序）。
 * apple-touch-icon.png 覆盖率极高，几乎所有现代站点都部署。
 */
export function faviconCandidates(domain: string): string[] {
  return [
    `https://${domain}/favicon.ico`,
    `https://${domain}/apple-touch-icon.png`,
    `https://${domain}/apple-touch-icon-precomposed.png`,
    `https://${domain}/favicon.png`,
  ]
}

/** 判断 URL 是否为 faviconUrl() 生成的通用路径（而非 Chrome 提供的真实地址） */
export function isGenericFavicon(url: string, domain: string): boolean {
  return url === `https://${domain}/favicon.ico`
}
