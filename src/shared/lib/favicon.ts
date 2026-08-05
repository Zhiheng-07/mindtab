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

/**
 * 判断 URL 是否为公共 favicon 服务（DuckDuckGo / Google s2）地址。
 * 这类 URL 不是站点真实图标来源，不能当作可靠 src 短路候选链
 * （历史上后台发现曾把未验证的 DDG URL 写入书签，见 faviconDiscovery.ts）。
 */
export function isServiceFavicon(url: string): boolean {
  return (
    url.startsWith('https://icons.duckduckgo.com/ip3/') ||
    url.startsWith('https://www.google.com/s2/favicons')
  )
}

// 常见双段公共后缀（简化处理，不引入完整 Public Suffix List）
const TWO_LEVEL_TLDS = new Set([
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn', 'ac.cn',
  'co.uk', 'org.uk', 'com.hk', 'com.tw', 'co.jp', 'com.au',
  'com.br', 'co.kr', 'com.sg',
])

/**
 * 取可注册根域（简化版）：sub.example.com → example.com；a.b.example.com.cn → example.com.cn。
 * 已是根域 / IP / localhost 等无根域可取时返回 null。
 * 用途：DDG 常只收录根域，子域名查 404 时用根域图标兜底。
 */
export function rootDomain(domain: string): string | null {
  if (/^[\d.]+$/.test(domain) || domain.includes(':')) return null // IPv4 / IPv6
  const parts = domain.split('.')
  if (parts.length < 3) return null
  const keep = TWO_LEVEL_TLDS.has(parts.slice(-2).join('.')) ? 3 : 2
  if (parts.length <= keep) return null
  return parts.slice(-keep).join('.')
}
